---
name: flutter-mobile-app
description: "Production guidelines for Flutter and Dart mobile and cross-platform applications, covering Dart 3 patterns, Riverpod state management, Clean Architecture, GoRouter navigation, and Dio HTTP networking."
category: mobile
tags: [flutter, dart, mobile, riverpod, gorouter, dio, clean-architecture]
license: "MIT"
---

# Flutter & Dart Cross-Platform Engineering

## Overview

Authoritative standards for production Flutter 3.x and Dart 3 applications targeting iOS, Android, web, and desktop. Focuses on declarative widget composition, type-safe state management with Riverpod, Clean Architecture layer separation, and resilient networking.

## Project Structure (Clean Feature-First Architecture)

```
lib/
├── core/
│   ├── constants/          # App constants, assets, theme colors
│   ├── network/            # Dio HTTP client, interceptors, error mapping
│   ├── router/             # GoRouter route definitions and guards
│   ├── theme/              # Material 3 color schemes and typography
│   └── utils/              # Extensions, formatters, helpers
├── features/
│   ├── auth/
│   │   ├── data/           # Models, DTOs, remote/local data sources
│   │   ├── domain/         # Entities, repository interfaces, use cases
│   │   └── presentation/   # Riverpod providers, screens, widgets
│   └── dashboard/
│       ├── data/
│       ├── domain/
│       └── presentation/
└── main.dart               # App entrypoint with ProviderScope
```

## State Management with Riverpod 2.x

Use Riverpod code-generation with `AsyncNotifier` for robust asynchronous state:

```dart
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'task_provider.g.dart';

@riverpod
class TaskListNotifier extends _$TaskListNotifier {
  @override
  FutureOr<List<Task>> build() async {
    return _fetchTasks();
  }

  Future<List<Task>> _fetchTasks() async {
    final repository = ref.read(taskRepositoryProvider);
    return repository.getTasks();
  }

  Future<void> addTask(String title) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      final repository = ref.read(taskRepositoryProvider);
      await repository.createTask(title);
      return _fetchTasks();
    });
  }
}
```

## Resilient Networking with Dio

Always configure timeouts, logging, and token refresh interceptors:

```dart
import 'package:dio/dio.dart';

Dio createDioClient(String baseUrl) {
  final dio = Dio(
    BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ),
  );

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        // Inject auth token from secure storage
        // options.headers['Authorization'] = 'Bearer $token';
        return handler.next(options);
      },
      onError: (DioException error, handler) async {
        if (error.response?.statusCode == 401) {
          // Trigger token refresh or redirect to login
        }
        return handler.next(error);
      },
    ),
  );

  return dio;
}
```

## Declarative Routing with GoRouter

```dart
import 'package:go_router/go_router.dart';

final router = GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const HomeScreen(),
      routes: [
        GoRoute(
          path: 'details/:id',
          builder: (context, state) {
            final id = state.pathParameters['id']!;
            return DetailsScreen(id: id);
          },
        ),
      ],
    ),
  ],
);
```

## Core Invariants

1. **Null Safety & Dart 3 Features**: Leverage Dart 3 records, pattern matching, and sealed classes for exhaustive state modeling (e.g. `sealed class AuthState {}`).
2. **Widget Composition over Deep Inheritance**: Prefer small, focused `StatelessWidget` and `ConsumerWidget` instances to maximize element subtree reuse and minimize rebuild costs.
3. **Never Block the UI Thread**: Offload expensive parsing or encryption to background workers using `compute()` or `Isolate.run()`.
4. **Platform Adaptation**: Respect platform norms using `Theme.of(context).platform` or Cupertino controls for iOS-native appearance.
