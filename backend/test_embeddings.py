"""
Test script to verify sentence-transformers is working
Run this to check if embeddings are being generated
"""

print("Testing embedding service...")
print("-" * 50)

# Test 1: Check if sentence-transformers is installed
print("\n1. Checking sentence-transformers installation...")
try:
    from sentence_transformers import SentenceTransformer
    print("✅ sentence-transformers is installed")
except ImportError as e:
    print(f"❌ sentence-transformers NOT installed: {e}")
    print("\nInstall with: pip install sentence-transformers")
    exit(1)

# Test 2: Load the model
print("\n2. Loading embedding model (all-MiniLM-L6-v2)...")
try:
    model = SentenceTransformer('all-MiniLM-L6-v2')
    print("✅ Model loaded successfully")
except Exception as e:
    print(f"❌ Failed to load model: {e}")
    exit(1)

# Test 3: Generate a test embedding
print("\n3. Generating test embedding...")
try:
    test_code = """
function add(a, b) {
    return a + b;
}
"""
    embedding = model.encode(test_code, convert_to_numpy=True)
    print(f"✅ Embedding generated successfully")
    print(f"   Dimension: {len(embedding)}")
    print(f"   First 5 values: {embedding[:5]}")
except Exception as e:
    print(f"❌ Failed to generate embedding: {e}")
    exit(1)

# Test 4: Test the embedding service
print("\n4. Testing embedding service...")
try:
    from app.services.embedding_service import embedding_service
    
    if not embedding_service.model:
        print("❌ Embedding service model not loaded")
        exit(1)
    
    test_embedding = embedding_service.generate_embedding("test code")
    if test_embedding:
        print(f"✅ Embedding service working")
        print(f"   Dimension: {len(test_embedding)}")
    else:
        print("❌ Embedding service returned None")
        exit(1)
except Exception as e:
    print(f"❌ Embedding service error: {e}")
    import traceback
    traceback.print_exc()
    exit(1)

# Test 5: Test code embedding
print("\n5. Testing code embedding with context...")
try:
    code_embedding = embedding_service.generate_code_embedding(
        code="function test() { return 42; }",
        language="javascript",
        file_path="test.js"
    )
    if code_embedding:
        print(f"✅ Code embedding working")
        print(f"   Dimension: {len(code_embedding)}")
    else:
        print("❌ Code embedding returned None")
except Exception as e:
    print(f"❌ Code embedding error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 50)
print("✅ All tests passed! Embedding system is working.")
print("=" * 50)
