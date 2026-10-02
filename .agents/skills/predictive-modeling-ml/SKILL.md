---
name: predictive-modeling-ml
description: "Production guidelines for tabular machine learning and predictive model development, covering feature engineering pipelines, gradient boosting (XGBoost/LightGBM/CatBoost), Optuna tuning, and cross-validation."
category: ai
tags: [machine-learning, tabular-data, xgboost, lightgbm, catboost, optuna, scikit-learn, prediction]
license: "MIT"
---

# Predictive Modeling & Tabular Machine Learning

## Overview

Authoritative standards for developing, evaluating, and deploying production tabular prediction models. Covers leak-free feature engineering, gradient boosting architectures (XGBoost, LightGBM, CatBoost), Bayesian hyperparameter optimization with Optuna, and stratified validation.

## Standard Scikit-Learn Preprocessing Pipeline

Prevent data leakage by fitting transformers strictly on training folds:

```python
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer

def build_preprocessor(numeric_features: list, categorical_features: list) -> ColumnTransformer:
    numeric_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler', StandardScaler()),
    ])

    categorical_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='constant', fill_value='missing')),
        ('encoder', OneHotEncoder(handle_unknown='ignore', sparse_output=False)),
    ])

    preprocessor = ColumnTransformer(
        transformers=[
            ('num', numeric_transformer, numeric_features),
            ('cat', categorical_transformer, categorical_features),
        ],
        remainder='drop',
    )
    return preprocessor
```

## Stratified Cross-Validation & Gradient Boosting

```python
import numpy as np
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import roc_auc_score
import xgboost as xgb

def train_stratified_cv(
    X: np.ndarray,
    y: np.ndarray,
    n_splits: int = 5,
    params: dict = None
) -> tuple[list, float]:
    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
    models = []
    oof_predictions = np.zeros(len(y))

    for fold, (train_idx, val_idx) in enumerate(skf.split(X, y)):
        X_train, y_train = X[train_idx], y[train_idx]
        X_val, y_val = X[val_idx], y[val_idx]

        model = xgb.XGBClassifier(
            n_estimators=1000,
            learning_rate=0.03,
            max_depth=6,
            subsample=0.8,
            colsample_bytree=0.8,
            early_stopping_rounds=50,
            eval_metric="auc",
            random_state=42 + fold,
            **(params or {})
        )

        model.fit(
            X_train, y_train,
            eval_set=[(X_val, y_val)],
            verbose=False
        )

        oof_predictions[val_idx] = model.predict_proba(X_val)[:, 1]
        models.append(model)

    cv_auc = roc_auc_score(y, oof_predictions)
    return models, cv_auc
```

## Bayesian Hyperparameter Optimization with Optuna

```python
import optuna
from optuna.samplers import TPESampler

def optimize_hyperparameters(X, y, n_trials=50) -> dict:
    def objective(trial):
        params = {
            'max_depth': trial.suggest_int('max_depth', 3, 10),
            'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.2, log=True),
            'subsample': trial.suggest_float('subsample', 0.5, 1.0),
            'colsample_bytree': trial.suggest_float('colsample_bytree', 0.5, 1.0),
            'reg_alpha': trial.suggest_float('reg_alpha', 1e-8, 10.0, log=True),
            'reg_lambda': trial.suggest_float('reg_lambda', 1e-8, 10.0, log=True),
        }
        _, score = train_stratified_cv(X, y, n_splits=5, params=params)
        return score

    study = optuna.create_study(direction="maximize", sampler=TPESampler(seed=42))
    study.optimize(objective, n_trials=n_trials, show_progress_bar=False)
    return study.best_params
```

## Core Invariants

1. **Strict Data Leakage Prevention**: Never fit scalers, target encoders, or imputers on the full dataset before splitting. Preprocessors must be fit **only** inside cross-validation folds.
2. **Early Stopping Mandate**: Always use early stopping with an independent validation set to prevent overfitting on complex boosted tree ensembles.
3. **Appropriate Metrics Selection**: Use PR-AUC (Precision-Recall AUC) or F-beta over standard accuracy or ROC-AUC when working with severely imbalanced targets (e.g. fraud detection, churn).
4. **Model Serialization**: Export production models using ONNX or Joblib with metadata recording feature names and expected schema versions.
