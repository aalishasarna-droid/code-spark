import re
from typing import Dict, List, Optional

class BundlerService:
    """
    Service to bundle multiple files together for execution
    Resolves imports and creates a single executable file
    """
    
    def bundle_javascript(self, files: Dict[str, str], entry_point: str) -> str:
        """
        Bundle JavaScript files with import resolution
        
        Args:
            files: Dict of {file_path: content}
            entry_point: Main file to execute
        
        Returns:
            Bundled JavaScript code
        """
        modules = {}
        
        # Convert each file to a module (lazy evaluation - only runs when required)
        for path, content in files.items():
            # Transform ES6 imports/exports to CommonJS-style
            transformed_content = self._transform_es6_to_commonjs(content)
            
            # Wrap in a factory function that returns the module
            # This prevents execution until require() is called
            wrapped = f"""
function() {{
  const exports = {{}};
  const module = {{ exports: exports }};
  
  {transformed_content}
  
  return module.exports;
}}
"""
            modules[path] = wrapped
        
        # Build the bundle
        bundle = "// Bundled JavaScript\n"
        bundle += "const __modules = {};\n"
        bundle += "const __moduleCache = {};\n\n"
        
        # Add all module factories
        for path, wrapped_content in modules.items():
            bundle += f"__modules['{path}'] = {wrapped_content};\n\n"
        
        # Add require function with path resolution and caching
        bundle += """
function require(modulePath) {
  // Normalize path
  let path = modulePath;
  
  // Add .js extension if missing
  if (!path.endsWith('.js')) {
    path += '.js';
  }
  
  // Remove leading ./
  if (path.startsWith('./')) {
    path = path.substring(2);
  }
  
  // Remove leading /
  if (path.startsWith('/')) {
    path = path.substring(1);
  }
  
  // Check cache first
  if (__moduleCache[path]) {
    return __moduleCache[path];
  }
  
  // Try exact match first
  let moduleFactory = __modules[path];
  
  // Try with leading slash
  if (!moduleFactory && __modules['/' + path]) {
    moduleFactory = __modules['/' + path];
    path = '/' + path;
  }
  
  // Try all paths to find a match
  if (!moduleFactory) {
    for (let key in __modules) {
      if (key.endsWith('/' + path) || key === path) {
        moduleFactory = __modules[key];
        path = key;
        break;
      }
    }
  }
  
  if (!moduleFactory) {
    throw new Error('Module not found: ' + modulePath + ' (tried: ' + path + ')');
  }
  
  // Execute module factory and cache result
  const moduleExports = moduleFactory();
  __moduleCache[path] = moduleExports;
  return moduleExports;
}

"""
        
        # Add entry point execution
        bundle += f"\n// Execute entry point: {entry_point}\nrequire('{entry_point}');\n"
        
        return bundle
    
    def _transform_es6_to_commonjs(self, content: str) -> str:
        """
        Transform ES6 import/export syntax to CommonJS
        """
        # Remove import statements and replace with require
        # import { add, subtract } from './utils.js' -> const { add, subtract } = require('./utils.js')
        content = re.sub(
            r"import\s+\{([^}]+)\}\s+from\s+['\"]([^'\"]+)['\"];?",
            r"const {\1} = require('\2');",
            content
        )
        
        # import * as name from './utils.js' -> const name = require('./utils.js')
        content = re.sub(
            r"import\s+\*\s+as\s+(\w+)\s+from\s+['\"]([^'\"]+)['\"];?",
            r"const \1 = require('\2');",
            content
        )
        
        # import name from './utils.js' -> const name = require('./utils.js')
        content = re.sub(
            r"import\s+(\w+)\s+from\s+['\"]([^'\"]+)['\"];?",
            r"const \1 = require('\2');",
            content
        )
        
        # export function name() {} -> function name() {} \n exports.name = name;
        content = re.sub(
            r"export\s+function\s+(\w+)",
            r"function \1",
            content
        )
        
        # export const name = -> const name = \n exports.name = name;
        content = re.sub(
            r"export\s+const\s+(\w+)\s*=",
            r"const \1 =",
            content
        )
        
        # export { name1, name2 } -> exports.name1 = name1; exports.name2 = name2;
        def replace_export_list(match):
            names = [n.strip() for n in match.group(1).split(',')]
            return '\n'.join([f"exports.{name} = {name};" for name in names])
        
        content = re.sub(
            r"export\s+\{([^}]+)\};?",
            replace_export_list,
            content
        )
        
        # Find all function declarations and add them to exports
        # This handles: export function name() {}
        function_matches = re.findall(r"function\s+(\w+)\s*\(", content)
        for func_name in function_matches:
            # Check if this function was exported (we removed the export keyword)
            # Add it to exports at the end
            if f"function {func_name}" in content and "exports." + func_name not in content:
                # Only add if it looks like it was meant to be exported
                # (this is a heuristic - in real code, track which were exported)
                pass
        
        # Add exports for functions that were marked as export
        # Look for patterns like "function add(" that came from "export function add("
        lines = content.split('\n')
        exports_to_add = []
        for i, line in enumerate(lines):
            # If we see a function definition and the previous context suggests it was exported
            if 'function ' in line and '(' in line:
                func_match = re.search(r'function\s+(\w+)\s*\(', line)
                if func_match:
                    func_name = func_match.group(1)
                    # Check if there's already an export for this
                    if not any(f'exports.{func_name}' in l for l in lines):
                        # Check if this looks like it should be exported (heuristic)
                        # For now, export all top-level functions
                        if not line.startswith(' ') and not line.startswith('\t'):
                            exports_to_add.append(f"exports.{func_name} = {func_name};")
        
        if exports_to_add:
            content += '\n\n' + '\n'.join(exports_to_add)
        
        return content
    
    def bundle_python(self, files: Dict[str, str], entry_point: str) -> str:
        """
        Bundle Python files with import resolution
        
        Args:
            files: Dict of {file_path: content}
            entry_point: Main file to execute
        
        Returns:
            Bundled Python code
        """
        # For Python, we can concatenate files with proper imports
        bundle = "# Bundled Python\n"
        bundle += "import sys\n"
        bundle += "from types import ModuleType\n\n"
        
        # Create modules for all files except entry point
        for path, content in files.items():
            if path == entry_point:
                continue  # Skip entry point for now
            
            # Create module name from path (e.g., /a/utils.py -> a_utils)
            module_name = path.replace('.py', '').replace('/', '_').lstrip('_')
            
            # Wrap in module
            bundle += f"# Module: {path}\n"
            bundle += f"{module_name}_module = ModuleType('{module_name}')\n"
            bundle += f"exec('''{content}''', {module_name}_module.__dict__)\n"
            bundle += f"sys.modules['{module_name}'] = {module_name}_module\n\n"
        
        # Add entry point
        if entry_point in files:
            bundle += f"# Entry point: {entry_point}\n"
            bundle += files[entry_point]
        
        return bundle
    
    def resolve_imports(self, content: str, language: str) -> List[str]:
        """
        Extract import statements from code
        
        Returns:
            List of imported file paths
        """
        imports = []
        
        if language == 'javascript':
            # Match: import ... from './file'
            # Match: require('./file')
            import_patterns = [
                r"import\s+.*\s+from\s+['\"](.+?)['\"]",
                r"require\(['\"](.+?)['\"]\)"
            ]
            
            for pattern in import_patterns:
                matches = re.findall(pattern, content)
                imports.extend(matches)
        
        elif language == 'python':
            # Match: from module import ...
            # Match: import module
            import_patterns = [
                r"from\s+(\w+)\s+import",
                r"import\s+(\w+)"
            ]
            
            for pattern in import_patterns:
                matches = re.findall(pattern, content)
                imports.extend(matches)
        
        return imports
    
    def get_dependencies(self, files: Dict[str, str], entry_point: str, language: str) -> List[str]:
        """
        Get all dependencies for a file (recursive)
        
        Returns:
            List of file paths in dependency order
        """
        visited = set()
        order = []
        
        def visit(path: str):
            if path in visited or path not in files:
                return
            
            visited.add(path)
            
            # Get imports from this file
            content = files[path]
            imports = self.resolve_imports(content, language)
            
            # Visit dependencies first
            for imp in imports:
                # Normalize import path
                if language == 'javascript':
                    if not imp.endswith('.js'):
                        imp += '.js'
                elif language == 'python':
                    if not imp.endswith('.py'):
                        imp += '.py'
                
                visit(imp)
            
            order.append(path)
        
        visit(entry_point)
        return order

# Global instance
bundler_service = BundlerService()
