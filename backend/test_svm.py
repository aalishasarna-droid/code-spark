from sklearn import datasets
from sklearn.model_selection import train_test_split
from sklearn.svm import SVC
from sklearn.metrics import accuracy_score

# Load iris dataset
iris = datasets.load_iris()
X = iris.data
y = iris.target

# Split data
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)

# Train SVM
clf = SVC(kernel='linear')
clf.fit(X_train, y_train)

# Predict
predictions = clf.predict(X_test)
acc = accuracy_score(y_test, predictions)

print(f"SVM Model trained successfully!")
print(f"Accuracy on test set: {acc * 100:.2f}%")
print(f"Sample predictions: {predictions[:5]}")
print(f"Actual targets:     {y_test[:5]}")
