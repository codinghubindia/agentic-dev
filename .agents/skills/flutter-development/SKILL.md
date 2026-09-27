---
name: flutter-development
description: Comprehensive Flutter/Dart guide covering project structure, widget architecture, state management (Riverpod/Bloc), navigation (GoRouter), API integration, platform channels, offline storage, animations, accessibility, testing, and app store release.
refreshMode: full
lastResearched: 2026-09-28
---

# Flutter Development Skill

Standards for building production-quality Flutter apps for iOS, Android, and Web.

---

## 1. Project Structure

```
lib/
├── main.dart                  # entry point — only bootstraps the app
├── app.dart                   # MaterialApp/CupertinoApp configuration
├── core/
│   ├── constants/             # app-wide constants, route names, asset paths
│   ├── errors/                # AppException, Failure types
│   ├── network/               # Dio client, interceptors, base URL config
│   ├── storage/               # SharedPreferences, Hive, secure storage wrappers
│   └── utils/                 # extensions, formatters, validators
├── features/
│   ├── auth/
│   │   ├── data/              # AuthRepository, AuthRemoteDataSource, AuthLocalDataSource
│   │   ├── domain/            # AuthUseCase, User entity
│   │   └── presentation/      # LoginPage, RegisterPage, AuthNotifier/Bloc
│   ├── todos/
│   │   ├── data/
│   │   ├── domain/
│   │   └── presentation/
│   └── settings/
├── shared/
│   ├── widgets/               # reusable UI components (AppButton, AppTextField, LoadingOverlay)
│   ├── theme/                 # AppTheme, AppColors, AppTextStyles, AppSpacing
│   └── providers/             # shared Riverpod providers
└── l10n/                      # localization (ARB files)
```

**Rule:** Feature-first structure. Never organize by type (`controllers/`, `models/`, `views/`) — it doesn't scale.

---

## 2. Widget Architecture

### Separation of Concerns

```dart
// Presentation: StatelessWidget + Consumer (Riverpod) or BlocBuilder
class TodoListPage extends ConsumerWidget {
  const TodoListPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final todosAsync = ref.watch(todosProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('My Tasks')),
      body: todosAsync.when(
        data: (todos) => TodoList(todos: todos),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => ErrorView(message: err.toString()),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.push('/todos/new'),
        child: const Icon(Icons.add),
      ),
    );
  }
}
```

**Widget rules:**
- Keep `build()` methods < 50 lines — extract sub-widgets
- Prefer `const` constructors everywhere possible (reduces rebuilds)
- Stateless > Stateful — lift state to providers, not local widget state
- Never put business logic in `build()` — call a method or use a provider

---

## 3. State Management — Riverpod

Use **Riverpod** (code generation variant) as the primary state management solution:

```dart
// providers/todos_provider.dart
@riverpod
class Todos extends _$Todos {
  @override
  Future<List<Todo>> build() async {
    return ref.watch(todoRepositoryProvider).getTodos();
  }

  Future<void> add(CreateTodoDto dto) async {
    await ref.read(todoRepositoryProvider).createTodo(dto);
    ref.invalidateSelf();  // refetch
  }

  Future<void> toggleComplete(String id, bool current) async {
    // Optimistic update
    state = AsyncData(state.requireValue
        .map((t) => t.id == id ? t.copyWith(completed: !current) : t)
        .toList());
    try {
      await ref.read(todoRepositoryProvider).update(id, completed: !current);
    } catch (_) {
      ref.invalidateSelf();  // revert on error
    }
  }
}
```

**Riverpod rules:**
- Use `@riverpod` code generation — don't write providers manually
- `AsyncNotifier` for async state with mutation methods
- `ref.watch` in `build()`, `ref.read` in callbacks
- Never access `ref` outside of providers and widgets

---

## 4. Navigation — GoRouter

```dart
// core/router/app_router.dart
@riverpod
GoRouter appRouter(AppRouterRef ref) {
  final isAuthenticated = ref.watch(isAuthenticatedProvider);

  return GoRouter(
    initialLocation: '/login',
    redirect: (context, state) {
      final onAuthPage = state.matchedLocation == '/login' ||
          state.matchedLocation == '/register';
      if (!isAuthenticated && !onAuthPage) return '/login';
      if (isAuthenticated && onAuthPage) return '/dashboard';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginPage()),
      GoRoute(path: '/register', builder: (_, __) => const RegisterPage()),
      ShellRoute(
        builder: (_, __, child) => AppShell(child: child),
        routes: [
          GoRoute(path: '/dashboard', builder: (_, __) => const DashboardPage()),
          GoRoute(
            path: '/todos/:id',
            builder: (_, state) => TodoDetailPage(id: state.pathParameters['id']!),
          ),
        ],
      ),
    ],
  );
}
```

---

## 5. API Integration — Dio

```dart
// core/network/api_client.dart
@singleton
class ApiClient {
  late final Dio _dio;

  ApiClient(AuthTokenStorage tokenStorage) {
    _dio = Dio(BaseOptions(
      baseUrl: Env.apiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 15),
      headers: {'Content-Type': 'application/json'},
    ));

    _dio.interceptors.addAll([
      AuthInterceptor(tokenStorage),
      RetryInterceptor(dio: _dio, retries: 2),
      LogInterceptor(requestBody: true, responseBody: true),
    ]);
  }

  Future<T> get<T>(String path, {Map<String, dynamic>? params}) async {
    try {
      final response = await _dio.get(path, queryParameters: params);
      return response.data as T;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }
  // post, put, patch, delete similarly...

  AppException _handleError(DioException e) {
    return switch (e.type) {
      DioExceptionType.connectionTimeout => const NetworkException('Connection timed out'),
      DioExceptionType.receiveTimeout => const NetworkException('Server not responding'),
      DioExceptionType.badResponse => ApiException(
          statusCode: e.response?.statusCode ?? 500,
          message: e.response?.data?['error'] ?? 'Server error',
        ),
      _ => const NetworkException('No internet connection'),
    };
  }
}
```

---

## 6. Local Storage

```dart
// Secure storage (tokens, sensitive data)
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
const _storage = FlutterSecureStorage();
await _storage.write(key: 'access_token', value: token);
final token = await _storage.read(key: 'access_token');

// Hive (structured local data, offline cache)
@HiveType(typeId: 0)
class CachedTodo extends HiveObject {
  @HiveField(0) final String id;
  @HiveField(1) final String title;
  @HiveField(2) final bool completed;
}

// SharedPreferences (simple key-value: user preferences)
final prefs = await SharedPreferences.getInstance();
await prefs.setBool('dark_mode', true);
```

**Rule:** Never store access tokens in SharedPreferences — use `flutter_secure_storage`.

---

## 7. Theme System

```dart
// shared/theme/app_theme.dart
class AppTheme {
  static ThemeData get light => ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: AppColors.primary,
      brightness: Brightness.light,
    ),
    textTheme: AppTextStyles.textTheme,
    inputDecorationTheme: InputDecorationTheme(
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        minimumSize: const Size.fromHeight(48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        textStyle: const TextStyle(fontWeight: FontWeight.w600),
      ),
    ),
  );

  static ThemeData get dark => light.copyWith(
    brightness: Brightness.dark,
    colorScheme: ColorScheme.fromSeed(
      seedColor: AppColors.primary,
      brightness: Brightness.dark,
    ),
  );
}
```

---

## 8. Offline-First Architecture

```dart
// Repository pattern with cache-then-network
class TodoRepository {
  final ApiClient _api;
  final Box<CachedTodo> _cache;

  Future<List<Todo>> getTodos() async {
    // 1. Return cached data immediately
    final cached = _cache.values.map((c) => c.toDomain()).toList();

    // 2. Fetch fresh data in background
    try {
      final fresh = await _api.get<List>('/todos');
      final todos = fresh.map(Todo.fromJson).toList();
      await _cache.clear();
      await _cache.addAll(todos.map((t) => t.toCached()));
      return todos;
    } catch (_) {
      // Return cached if network fails
      if (cached.isNotEmpty) return cached;
      rethrow;
    }
  }
}
```

---

## 9. Accessibility

```dart
// Always wrap custom interactive widgets with Semantics
Semantics(
  label: 'Delete task: ${todo.title}',
  button: true,
  child: GestureDetector(
    onTap: () => onDelete(todo.id),
    child: const Icon(Icons.delete, color: Colors.red),
  ),
)

// Use ExcludeSemantics for decorative elements
ExcludeSemantics(child: const Icon(Icons.star))

// Ensure touch targets ≥ 44×44dp
SizedBox(
  width: 44,
  height: 44,
  child: IconButton(icon: const Icon(Icons.edit), onPressed: onEdit),
)

// Support dynamic text sizes
Text(
  label,
  style: Theme.of(context).textTheme.bodyMedium,
  // Never hardcode font sizes — use theme text styles
)
```

---

## 10. Testing

```dart
// Widget test
testWidgets('TodoItem shows title and checkbox', (tester) async {
  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(home: TodoItem(todo: fakeTodo)),
    ),
  );

  expect(find.text(fakeTodo.title), findsOneWidget);
  expect(find.byType(Checkbox), findsOneWidget);

  await tester.tap(find.byType(Checkbox));
  await tester.pump();
  // verify state change
});

// Unit test for use cases
test('CreateTodoUseCase saves to repository', () async {
  final mockRepo = MockTodoRepository();
  when(() => mockRepo.create(any())).thenAnswer((_) async => fakeTodo);

  final useCase = CreateTodoUseCase(mockRepo);
  final result = await useCase(CreateTodoDto(title: 'Test', priority: Priority.high));

  expect(result, isA<Todo>());
  verify(() => mockRepo.create(any())).called(1);
});
```

---

## 11. Performance Rules

- Use `const` widgets everywhere — prevents unnecessary rebuilds
- Use `ListView.builder` for lists (never `Column` with `map()` for > 20 items)
- Use `RepaintBoundary` around frequently-animating widgets
- Profile with Flutter DevTools before optimizing — don't guess
- Image optimization: use `cached_network_image`, specify `width`/`height`, use `fit: BoxFit.cover`
- Avoid `setState()` high up in the widget tree — use providers to scope rebuilds

---

## 12. Release Checklist

**Android:**
- [ ] Update `versionName` and `versionCode` in `android/app/build.gradle`
- [ ] Sign with release keystore (`key.properties` — never commit the keystore)
- [ ] Run `flutter build appbundle --release`
- [ ] Test on a real device

**iOS:**
- [ ] Update `CFBundleShortVersionString` and `CFBundleVersion` in `ios/Runner/Info.plist`
- [ ] Set team in Xcode, valid provisioning profile
- [ ] Run `flutter build ipa --release`
- [ ] Test on a real device

**Both:**
- [ ] No debug logs in release builds (`kReleaseMode` guard or use `logger` package)
- [ ] Obfuscate: `flutter build appbundle --obfuscate --split-debug-info=debug_info/`
- [ ] All environment variables via `--dart-define` or `flutter_dotenv` (never hardcoded)
