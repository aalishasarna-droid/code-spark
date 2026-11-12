from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import subprocess
import tempfile
import os
from pathlib import Path
from app.services.supabase_service import supabase_service
from app.services.file_service import file_service
from app.services.bundler_service import bundler_service
from typing import Optional, Dict

router = APIRouter()

class ExecuteRequest(BaseModel):
    code: str
    language: str  # "javascript", "python", "cpp"
    input: str = ""  # stdin input
    session_id: str = ""  # optional session tracking
    file_path: str = "main.js"  # file name
    project_id: Optional[str] = None  # for multi-file execution

class ExecuteResponse(BaseModel):
    output: str
    error: str
    exit_code: int
    execution_time: float
    snapshot_id: str = ""  # ID of saved snapshot

@router.post("/run", response_model=ExecuteResponse)
async def execute_code(request: ExecuteRequest):
    """
    Execute code in a sandboxed environment
    Supports: JavaScript (Node.js), Python, C++
    Can bundle multiple files if project_id is provided
    """
    try:
        import time
        start_time = time.time()
        
        code_to_execute = request.code
        
        # If project_id provided, bundle all files
        if request.project_id:
            print(f"Multi-file execution for project: {request.project_id}")
            files_list = await file_service.get_project_files(request.project_id)
            
            # Determine file extension for the language
            lang_extensions = {
                "javascript": [".js"],
                "python": [".py"],
                "cpp": [".cpp", ".c", ".h"]
            }
            
            valid_extensions = lang_extensions.get(request.language, [])
            
            # Build files dict - only include files of the same language
            files_dict = {}
            for f in files_list:
                if not f.get('is_folder', False):
                    # Check if file matches the language
                    file_ext = Path(f['path']).suffix
                    if file_ext in valid_extensions:
                        # CRITICAL: Use code from request for the current file
                        # This ensures we use the latest code, not stale database content
                        if f['path'] == request.file_path:
                            files_dict[f['path']] = request.code
                        else:
                            files_dict[f['path']] = f['content']
            
            print(f"Found {len(files_dict)} {request.language} files to bundle")
            
            # Only bundle if there are multiple files or imports
            if len(files_dict) > 1:
                # Bundle files
                if request.language == "javascript":
                    code_to_execute = bundler_service.bundle_javascript(
                        files_dict,
                        request.file_path
                    )
                elif request.language == "python":
                    code_to_execute = bundler_service.bundle_python(
                        files_dict,
                        request.file_path
                    )
                print("Code bundled successfully")
            else:
                # Single file, just use the code as-is
                print("Single file execution, no bundling needed")
                code_to_execute = request.code
        
        # Execute the code
        if request.language == "javascript":
            result = _run_javascript(code_to_execute, request.input)
        elif request.language == "python":
            result = _run_python(code_to_execute, request.input)
        elif request.language == "cpp":
            result = _run_cpp(code_to_execute, request.input)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported language: {request.language}")
        
        execution_time = time.time() - start_time
        
        # Save to database if session_id provided
        snapshot_id = ""
        if request.session_id:
            print(f"Attempting to save code snapshot for session: {request.session_id}")
            if supabase_service.is_available():
                snapshot_id = await supabase_service.save_code_snapshot(
                    session_id=request.session_id,
                    code=request.code,
                    language=request.language,
                    file_path=request.file_path,
                    execution_output=result["output"],
                    execution_error=result["error"]
                ) or ""
                if snapshot_id:
                    print(f"Code snapshot saved with ID: {snapshot_id}")
                else:
                    print("Failed to save code snapshot")
            else:
                print("Supabase not available")
        else:
            print("No session_id provided, skipping database save")
        
        return ExecuteResponse(
            output=result["output"],
            error=result["error"],
            exit_code=result["exit_code"],
            execution_time=execution_time,
            snapshot_id=snapshot_id
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def _run_javascript(code: str, stdin: str) -> dict:
    """Run JavaScript code using Node.js"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False, encoding='utf-8') as f:
        f.write(code)
        temp_file = f.name
    
    try:
        result = subprocess.run(
            ['node', temp_file],
            input=stdin,
            capture_output=True,
            text=True,
            timeout=5,  # 5 second timeout
            encoding='utf-8',
            errors='replace'  # Replace encoding errors
        )
        return {
            "output": result.stdout,
            "error": result.stderr,
            "exit_code": result.returncode
        }
    except subprocess.TimeoutExpired:
        return {
            "output": "",
            "error": "Execution timed out (5 seconds limit)",
            "exit_code": -1
        }
    except FileNotFoundError:
        return {
            "output": "",
            "error": "Node.js not found. Please install Node.js to run JavaScript code.",
            "exit_code": -1
        }
    finally:
        try:
            os.unlink(temp_file)
        except:
            pass

def _run_python(code: str, stdin: str) -> dict:
    """Run Python code"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as f:
        f.write(code)
        temp_file = f.name
    
    try:
        result = subprocess.run(
            ['python', temp_file],
            input=stdin,
            capture_output=True,
            text=True,
            timeout=5,
            encoding='utf-8',
            errors='replace'  # Replace encoding errors
        )
        return {
            "output": result.stdout,
            "error": result.stderr,
            "exit_code": result.returncode
        }
    except subprocess.TimeoutExpired:
        return {
            "output": "",
            "error": "Execution timed out (5 seconds limit)",
            "exit_code": -1
        }
    except FileNotFoundError:
        return {
            "output": "",
            "error": "Python not found. Please install Python.",
            "exit_code": -1
        }
    finally:
        try:
            os.unlink(temp_file)
        except:
            pass

def _run_cpp(code: str, stdin: str) -> dict:
    """Compile and run C++ code"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.cpp', delete=False, encoding='utf-8') as f:
        f.write(code)
        source_file = f.name
    
    exe_file = source_file.replace('.cpp', '.exe' if os.name == 'nt' else '')
    
    try:
        # Compile
        compile_result = subprocess.run(
            ['g++', source_file, '-o', exe_file],
            capture_output=True,
            text=True,
            timeout=10,
            encoding='utf-8',
            errors='replace'
        )
        
        if compile_result.returncode != 0:
            return {
                "output": "",
                "error": f"Compilation error:\n{compile_result.stderr}",
                "exit_code": compile_result.returncode
            }
        
        # Run
        run_result = subprocess.run(
            [exe_file],
            input=stdin,
            capture_output=True,
            text=True,
            timeout=5,
            encoding='utf-8',
            errors='replace'
        )
        
        return {
            "output": run_result.stdout,
            "error": run_result.stderr,
            "exit_code": run_result.returncode
        }
    except subprocess.TimeoutExpired:
        return {
            "output": "",
            "error": "Execution timed out",
            "exit_code": -1
        }
    except FileNotFoundError:
        return {
            "output": "",
            "error": "C++ compiler (g++) not found. Please install GCC/MinGW.",
            "exit_code": -1
        }
    finally:
        try:
            if os.path.exists(source_file):
                os.unlink(source_file)
            if os.path.exists(exe_file):
                os.unlink(exe_file)
        except:
            pass
