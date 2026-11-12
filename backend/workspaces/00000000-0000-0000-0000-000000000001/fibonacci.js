export function fibonacci(n) {
  let a = 0, b = 1;
  let result = [];
  
  for (let i = 0; i < n; i++) {
    result.push(a);
    [a, b] = [b, a + b];
  }
  
  return result;
}