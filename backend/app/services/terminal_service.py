import asyncio
import subprocess
import os
from typing import Optional, Dict, List
import uuid

class TerminalSession:
    """Represents a terminal session"""
    
    def __init__(self, session_id: str, working_dir: str):
        self.session_id = session_id
        self.working_dir = working_dir
        self.process: Optional[subprocess.Popen] = None
        self.history: List[Dict] = []
    
    async def execute_command(self, command: str) -> Dict:
        """Execute a command and return output"""
        try:
            # Security: Block dangerous commands
            dangerous_commands = ['rm -rf', 'format', 'del /f', 'shutdown', 'reboot']
            if any(cmd in command.lower() for cmd in dangerous_commands):
                return {
                    "output": "",
                    "error": "Command blocked for security reasons",
                    "exit_code": 1
                }
            
            # Execute command
            process = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=self.working_dir,
                shell=True
            )
            
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=30.0  # 30 second timeout
            )
            
            result = {
                "output": stdout.decode('utf-8', errors='replace'),
                "error": stderr.decode('utf-8', errors='replace'),
                "exit_code": process.returncode or 0
            }
            
            # Add to history
            self.history.append({
                "command": command,
                "result": result
            })
            
            return result
            
        except asyncio.TimeoutError:
            return {
                "output": "",
                "error": "Command timed out (30 seconds)",
                "exit_code": 124
            }
        except Exception as e:
            return {
                "output": "",
                "error": str(e),
                "exit_code": 1
            }

class TerminalService:
    """
    Service for managing terminal sessions
    Supports command execution, npm install, etc.
    """
    
    def __init__(self):
        self.sessions: Dict[str, TerminalSession] = {}
        self.base_workspace = os.path.join(os.getcwd(), "workspaces")
        
        # Create workspaces directory
        os.makedirs(self.base_workspace, exist_ok=True)
    
    def create_session(self, project_id: str) -> str:
        """Create a new terminal session"""
        session_id = str(uuid.uuid4())
        
        # Create project workspace
        workspace_dir = os.path.join(self.base_workspace, project_id)
        os.makedirs(workspace_dir, exist_ok=True)
        
        session = TerminalSession(session_id, workspace_dir)
        self.sessions[session_id] = session
        
        return session_id
    
    def get_session(self, session_id: str) -> Optional[TerminalSession]:
        """Get an existing session"""
        return self.sessions.get(session_id)
    
    async def execute_command(self, session_id: str, command: str) -> Dict:
        """Execute a command in a session"""
        session = self.get_session(session_id)
        
        if not session:
            return {
                "output": "",
                "error": "Session not found",
                "exit_code": 1
            }
        
        return await session.execute_command(command)
    
    def get_history(self, session_id: str) -> List[Dict]:
        """Get command history for a session"""
        session = self.get_session(session_id)
        return session.history if session else []
    
    def close_session(self, session_id: str):
        """Close a terminal session"""
        if session_id in self.sessions:
            del self.sessions[session_id]
    
    async def npm_install(self, session_id: str, package: Optional[str] = None) -> Dict:
        """Run npm install"""
        command = f"npm install {package}" if package else "npm install"
        return await self.execute_command(session_id, command)
    
    async def npm_run(self, session_id: str, script: str) -> Dict:
        """Run npm script"""
        command = f"npm run {script}"
        return await self.execute_command(session_id, command)
    
    def sync_files_to_workspace(self, session_id: str, files: Dict[str, str]):
        """Sync files from database to workspace"""
        session = self.get_session(session_id)
        if not session:
            return
        
        for file_path, content in files.items():
            full_path = os.path.join(session.working_dir, file_path)
            
            # Create directories if needed
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            
            # Write file
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(content)

# Global instance
terminal_service = TerminalService()
