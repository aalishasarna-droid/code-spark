import logging
import numpy as np
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    roc_auc_score
)

# -------------------------------------------------------------------
# 1. Configure Logging
# -------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)

def run_svm_pipeline():
    # -------------------------------------------------------------------
    # 2. Load Dataset
    # -------------------------------------------------------------------
    logging.info("Step 1: Loading dataset...")
    data = load_breast_cancer()
    X, y = data.data, data.target
    logging.info(f"Dataset loaded successfully: {X.shape[0]} samples, {X.shape[1]} features.")
    logging.info(f"Target classes: {data.target_names.tolist()}")

    # -------------------------------------------------------------------
    # 3. Train / Test Split
    # -------------------------------------------------------------------
    logging.info("Step 2: Splitting dataset into training (80%) and testing (20%) sets...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    logging.info(f"Training set size: {X_train.shape[0]} samples")
    logging.info(f"Test set size: {X_test.shape[0]} samples")

    # -------------------------------------------------------------------
    # 4. Feature Scaling (Essential for SVM)
    # -------------------------------------------------------------------
    logging.info("Step 3: Scaling features using StandardScaler...")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    logging.info("Features successfully scaled (mean=0, variance=1).")

    # -------------------------------------------------------------------
    # 5. Initialize and Train Model
    # -------------------------------------------------------------------
    logging.info("Step 4: Initializing Support Vector Classifier (SVC)...")
    # Setting probability=True allows calculation of ROC-AUC probabilities
    svm_model = SVC(kernel='rbf', C=1.0, gamma='scale', probability=True, random_state=42)
    
    logging.info("Training the SVM model...")
    svm_model.fit(X_train_scaled, y_train)
    logging.info("Model training complete!")

    # -------------------------------------------------------------------
    # 6. Evaluation
    # -------------------------------------------------------------------
    logging.info("Step 5: Making predictions on test set...")
    y_pred = svm_model.predict(X_test_scaled)
    y_proba = svm_model.predict_proba(X_test_scaled)[:, 1]

    logging.info("Step 6: Calculating evaluation metrics...")
    acc = accuracy_score(y_test, y_pred)
    roc_auc = roc_auc_score(y_test, y_proba)
    cm = confusion_matrix(y_test, y_pred)
    report = classification_report(y_test, y_pred, target_names=data.target_names)

    # -------------------------------------------------------------------
    # 7. Print Results
    # -------------------------------------------------------------------
    print("\n" + "=" * 55)
    print("                 EVALUATION RESULTS                 ")
    print("=" * 55)
    print(f"Accuracy Score : {acc:.4f} ({acc * 100:.2f}%)")
    print(f"ROC-AUC Score  : {roc_auc:.4f}")
    print("\nConfusion Matrix:")
    print(cm)
    print("\nClassification Report:")
    print(report)
    print("=" * 55)

    logging.info("Pipeline execution finished successfully.")

if __name__ == "__main__":
    run_svm_pipeline()