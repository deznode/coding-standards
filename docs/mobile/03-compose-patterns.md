# Compose Patterns

Defines the UI architecture, state management, navigation, and composable design rules for Jetpack Compose projects.

**Why?** Without consistent patterns, Compose codebases fragment into a mix of stateful and stateless composables with no clear boundary between ViewModel wiring and pure UI rendering. The Route/Screen split, typed navigation routes, and strict naming conventions established here ensure every screen is independently testable, navigation is compile-safe, and the team shares a common vocabulary for state, events, and UI structure.

---

## Route/Screen Split Pattern

Every screen destination MUST be implemented as two composables: a **Route** that wires the ViewModel and handles side effects, and a **Screen** that is a pure, stateless composable receiving only state and event callbacks.

```kotlin
// Route: wires ViewModel, handles navigation side effects
@Composable
fun ProductDetailRoute(
    onNavigateBack: () -> Unit,
    onNavigateToCart: () -> Unit,
    viewModel: ProductDetailViewModel = koinViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                ProductDetailEvent.NavigateToCart -> onNavigateToCart()
                ProductDetailEvent.NavigateBack -> onNavigateBack()
            }
        }
    }

    ProductDetailScreen(
        state = state,
        onEvent = viewModel::onEvent,
    )
}

// Screen: pure composable, fully testable without ViewModel
@Composable
fun ProductDetailScreen(
    state: ProductDetailUiState,
    onEvent: (ProductDetailUiEvent) -> Unit,
    modifier: Modifier = Modifier,
) {
    Scaffold(modifier = modifier) { padding ->
        Column(modifier = Modifier.padding(padding)) {
            Text(text = state.name, style = MaterialTheme.typography.headlineMedium)
            Text(text = state.formattedPrice)
            Button(onClick = { onEvent(ProductDetailUiEvent.AddToCart) }) {
                Text("Add to Cart")
            }
        }
    }
}
```

The Screen composable has no dependency on ViewModels, navigation controllers, or DI frameworks. It can be tested in isolation with a `ComposeTestRule` by passing fake state directly.

MUST separate Route (ViewModel-aware) from Screen (pure composable) for every navigation destination.

---

## MVVM + StateFlow + Channel

Use `StateFlow` for persistent UI state and `Channel` for one-shot events (navigation, snackbar, toast). This is the standard Android recommendation and the pragmatic default for most applications.

### State and Event Model

```kotlin
// State: represents the entire UI surface of one screen
data class LoginUiState(
    val email: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
)

// Events: one-shot effects that the UI consumes exactly once
sealed interface LoginUiEvent {
    data object NavigateToHome : LoginUiEvent
    data class ShowSnackbar(val message: String) : LoginUiEvent
}

// User actions: intents from the UI layer to the ViewModel
sealed interface LoginUiAction {
    data class EmailChanged(val value: String) : LoginUiAction
    data class PasswordChanged(val value: String) : LoginUiAction
    data object LoginClicked : LoginUiAction
}
```

### ViewModel

```kotlin
class LoginViewModel(
    private val authRepo: AuthRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    // Channel is preferred over SharedFlow for one-shot events:
    // it buffers exactly one undelivered event and does not replay.
    private val _events = Channel<LoginUiEvent>(Channel.BUFFERED)
    val events: Flow<LoginUiEvent> = _events.receiveAsFlow()

    fun onAction(action: LoginUiAction) {
        when (action) {
            is LoginUiAction.EmailChanged ->
                _uiState.update { it.copy(email = action.value) }
            is LoginUiAction.PasswordChanged ->
                _uiState.update { it.copy(password = action.value) }
            LoginUiAction.LoginClicked -> login()
        }
    }

    private fun login() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            authRepo.login(_uiState.value.email, _uiState.value.password)
                .onSuccess { _events.send(LoginUiEvent.NavigateToHome) }
                .onFailure { e -> _uiState.update { it.copy(error = e.message) } }
            _uiState.update { it.copy(isLoading = false) }
        }
    }
}
```

MUST use `Channel(Channel.BUFFERED)` for one-shot events (navigation, snackbar). MUST NOT use `SharedFlow(replay=1)` for navigation events -- it causes double-delivery when the observer resubscribes after configuration change.

---

## `collectAsStateWithLifecycle` over `collectAsState`

MUST use `collectAsStateWithLifecycle()` from `androidx.lifecycle:lifecycle-runtime-compose` instead of `collectAsState()`. The lifecycle-aware variant automatically pauses collection when the app moves to the background (below `Lifecycle.State.STARTED`), saving CPU and battery.

```kotlin
// CORRECT: pauses collection when the app is backgrounded
val state by viewModel.uiState.collectAsStateWithLifecycle()

// WRONG: continues collecting even when the app is in the background
val state by viewModel.uiState.collectAsState()
```

The default minimum lifecycle state is `STARTED`. Collection resumes automatically when the lifecycle returns to `STARTED` or higher.

```kotlin
// Custom lifecycle threshold (rarely needed)
val state by viewModel.uiState.collectAsStateWithLifecycle(
    minActiveState = Lifecycle.State.RESUMED
)
```

---

## MVI Reducer Pattern

For screens with complex business logic or where testability of state transitions is critical, use the MVI reducer pattern. The reducer is a pure function that takes the current state and an intent, and returns the new state:

```kotlin
sealed interface LoginIntent {
    data class EmailChanged(val value: String) : LoginIntent
    data class PasswordChanged(val value: String) : LoginIntent
    data object LoginClicked : LoginIntent
    data object LoginSuccess : LoginIntent
    data class LoginFailed(val message: String) : LoginIntent
}

// Pure function -- trivially unit tested
fun reduce(state: LoginUiState, intent: LoginIntent): LoginUiState = when (intent) {
    is LoginIntent.EmailChanged -> state.copy(email = intent.value)
    is LoginIntent.PasswordChanged -> state.copy(password = intent.value)
    LoginIntent.LoginClicked -> state.copy(isLoading = true, error = null)
    LoginIntent.LoginSuccess -> state.copy(isLoading = false)
    is LoginIntent.LoginFailed -> state.copy(isLoading = false, error = intent.message)
}
```

MVI adds boilerplate but offers pure reducers that are trivially unit-tested and enable time-travel debugging. MAY use MVI for screens with complex state transitions. SHOULD default to MVVM + StateFlow + Channel for straightforward screens.

---

## Type-Safe Navigation

MUST use type-safe navigation with `@Serializable` data classes (Navigation 2.8+). String-based routes are prohibited.

### Route Declarations

Place all route definitions in a `routes/` package within a shared navigation module:

```kotlin
// :navigation module -- routes/AppRoutes.kt
package com.example.app.routes

import kotlinx.serialization.Serializable

@Serializable
object HomeRoute

@Serializable
data class ProductDetailRoute(val productId: String)

@Serializable
data class OrderRoute(val orderId: Long, val showReceipt: Boolean = false)

@Serializable
object AuthGraph    // Nested graph marker

@Serializable
object LoginRoute

@Serializable
object RegisterRoute
```

### NavHost Setup

```kotlin
@Composable
fun AppNavHost(navController: NavHostController = rememberNavController()) {
    NavHost(navController = navController, startDestination = HomeRoute) {
        composable<HomeRoute> {
            HomeRoute(
                onProductClick = { id ->
                    navController.navigate(ProductDetailRoute(productId = id))
                },
            )
        }
        composable<ProductDetailRoute> { backStackEntry ->
            val route: ProductDetailRoute = backStackEntry.toRoute()
            ProductDetailRoute(
                productId = route.productId,
                onNavigateToCart = {
                    navController.navigate(OrderRoute(orderId = it))
                },
                onNavigateBack = { navController.popBackStack() },
            )
        }
        composable<OrderRoute> { backStackEntry ->
            val route: OrderRoute = backStackEntry.toRoute()
            OrderRoute(orderId = route.orderId, showReceipt = route.showReceipt)
        }
    }
}
```

### Nested Navigation Graphs

```kotlin
fun NavGraphBuilder.authGraph(navController: NavHostController) {
    navigation<AuthGraph>(startDestination = LoginRoute) {
        composable<LoginRoute> {
            LoginRoute(onSuccess = { navController.navigate(HomeRoute) })
        }
        composable<RegisterRoute> {
            RegisterRoute(onSuccess = { navController.navigate(HomeRoute) })
        }
    }
}
```

Supported argument types (Navigation 2.8.5+): `Int`, `Long`, `Float`, `Double`, `Boolean`, `String`, `Enum<*>`, nullable variants, `List<T>` for primitives and enums, and value classes (2.9.0+).

MUST use `@Serializable` route classes for all navigation destinations. MUST NOT use string-based routes or manual argument parsing. MUST place route definitions in a shared `routes/` package to avoid circular dependencies between feature modules.

---

## Strong Skipping Mode

Strong skipping mode (enabled by default in Kotlin 2.2+ / Compose compiler 1.8+) relaxes the stability requirement: unstable parameters are skipped by reference equality, and lambda parameters are always considered stable.

Impact: most apps no longer need `@Stable` or `@Immutable` workarounds for data classes. However, stability annotations still help for:

- Explicit API contracts on public composable parameters
- Classes crossing module boundaries
- `List<T>` (still unstable even with strong skipping -- use `ImmutableList` from `kotlinx.collections.immutable` for performance-critical lists)

```kotlin
// With strong skipping (Kotlin 2.2+), this works without annotations:
data class ProductUiState(
    val name: String,
    val price: String,
    val imageUrl: String,
)

// For lists in performance-critical paths, use ImmutableList:
@Composable
fun ProductGrid(
    products: ImmutableList<ProductUiState>,  // Stable -- skippable
    modifier: Modifier = Modifier,
) { ... }
```

SHOULD rely on strong skipping mode rather than manual `@Stable`/`@Immutable` annotations. SHOULD use `ImmutableList` from `kotlinx.collections.immutable` for list parameters in composables that recompose frequently.

---

## LazyColumn Optimization

MUST provide `key` and `contentType` parameters to all `LazyColumn` / `LazyRow` / `LazyGrid` item calls:

```kotlin
LazyColumn {
    items(
        items = products,
        key = { product -> product.id },          // Stable identity: prevents re-layout on reorder
        contentType = { product -> product.type }, // Composition reuse across same-type items
    ) { product ->
        ProductCard(product = product)
    }
}
```

| Parameter | Purpose |
|-----------|---------|
| `key` | Provides stable identity so Compose can track items across reorders and updates without re-laying out the entire list |
| `contentType` | Enables Compose to reuse item compositions between items of the same type in a mixed-type list |

MUST set `key` to a stable, unique identifier for every lazy list item. SHOULD set `contentType` when the list contains mixed item types.

---

## `derivedStateOf` for Expensive Computed State

Use `derivedStateOf` when computing a value from other state objects. It re-runs only when its inputs change, avoiding unnecessary recompositions:

```kotlin
val isSubmitEnabled by remember {
    derivedStateOf { email.isNotBlank() && password.length >= 8 }
}
```

Without `derivedStateOf`, the expression would re-evaluate on every recomposition of the parent, even if neither `email` nor `password` changed.

SHOULD use `derivedStateOf` for any computed state derived from other state values, especially in composables that recompose frequently.

---

## `rememberSaveable` for Configuration Change and Process Death

Use `rememberSaveable` for UI state that must survive configuration changes (rotation, dark mode toggle) and process death:

```kotlin
// Survives config changes AND process death (uses Bundle internally)
var counter by rememberSaveable { mutableIntStateOf(0) }

// For non-Parcelable types, use a custom saver
var customState by rememberSaveable(stateSaver = customSaver) {
    mutableStateOf(CustomType())
}
```

For ViewModel-scoped state that must survive process death, use `SavedStateHandle`:

```kotlin
class LoginViewModel(
    private val savedStateHandle: SavedStateHandle,
) : ViewModel() {
    // Automatically saved/restored across process death
    val email: StateFlow<String> = savedStateHandle.getStateFlow("email", "")

    fun onEmailChange(value: String) {
        savedStateHandle["email"] = value
    }
}
```

| Mechanism | Survives recomposition | Survives config change | Survives process death |
|-----------|:-----:|:-----:|:-----:|
| `remember` | Yes | No | No |
| `rememberSaveable` | Yes | Yes | Yes |
| `SavedStateHandle` (ViewModel) | Yes | Yes | Yes |

MUST use `rememberSaveable` for user-facing UI state (text input, scroll position, toggle state). MUST use `SavedStateHandle` in ViewModels for state that must survive process death.

---

## Material3 + Dynamic Color + MotionScheme

### Theme Setup

```kotlin
@Composable
fun AppTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = true,
    content: @Composable () -> Unit,
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context)
            else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = AppTypography,
        shapes = AppShapes,
        content = content,
    )
}
```

### MotionScheme (Material3 1.3+)

Material3 introduced `MotionScheme` -- a set of `AnimationSpec` tokens matching Material's motion guidelines:

```kotlin
// Spatial transitions (enter/exit) -- spring with overshoot
val enterSpec = MaterialTheme.motionScheme.fastSpatialSpec<Float>()

// Effect transitions -- spring without overshoot
val effectSpec = MaterialTheme.motionScheme.defaultEffectsSpec<Dp>()

AnimatedVisibility(
    visible = isVisible,
    enter = fadeIn(animationSpec = MaterialTheme.motionScheme.fastEffectsSpec()),
    exit = fadeOut(animationSpec = MaterialTheme.motionScheme.fastEffectsSpec()),
)
```

MUST use `MaterialTheme.motionScheme` for all animations instead of hardcoded `tween()` or `spring()` values. This ensures consistency with Material's motion language and allows theme-level animation tuning.

---

## Accessibility

### Semantic Tree

Every composable exposes a semantic tree used by TalkBack and accessibility services. Most Material3 components set appropriate semantics automatically, but custom composables need explicit annotations.

```kotlin
// Content description for images
Image(
    painter = painterResource(R.drawable.ic_product),
    contentDescription = stringResource(R.string.product_image_description),
)

// Merge children semantics (treat a card as a single focusable unit)
Card(
    modifier = Modifier.semantics(mergeDescendants = true) {}
) {
    Text("Product name")
    Text("$9.99")
}
```

### Custom Accessibility Actions

```kotlin
Box(
    modifier = Modifier.semantics {
        contentDescription = "Swipeable item: ${item.name}"
        customActions = listOf(
            CustomAccessibilityAction("Delete") { onDelete(item.id); true },
            CustomAccessibilityAction("Archive") { onArchive(item.id); true },
        )
    }
)
```

### Focus Management

```kotlin
val focusRequester = remember { FocusRequester() }

TextField(
    modifier = Modifier.focusRequester(focusRequester),
    value = text,
    onValueChange = onTextChange,
)

LaunchedEffect(Unit) {
    focusRequester.requestFocus()   // Auto-focus on screen entry
}
```

MUST provide `contentDescription` for all non-decorative images and icons. MUST use `semantics(mergeDescendants = true)` for composite elements that should be read as a single unit. SHOULD provide custom accessibility actions for swipeable or gesture-based interactions.

---

## Slot-Based API Design

Design reusable composables with slot parameters (`@Composable () -> Unit` lambdas) to decouple layout structure from content:

```kotlin
@Composable
fun AppCard(
    modifier: Modifier = Modifier,
    header: @Composable () -> Unit,
    actions: (@Composable RowScope.() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Card(modifier = modifier) {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f)) { header() }
                actions?.let { Row { it() } }
            }
            HorizontalDivider()
            content()
        }
    }
}

// Usage
AppCard(
    header = { Text("Order #1234", style = MaterialTheme.typography.titleMedium) },
    actions = {
        IconButton(onClick = { /* ... */ }) {
            Icon(Icons.Default.MoreVert, contentDescription = "More options")
        }
    },
) {
    Text("Order details go here")
}
```

SHOULD use slot-based APIs for all reusable layout components. MUST NOT hardcode content inside reusable composables.

---

## Naming Conventions

Consistent naming across the codebase makes patterns recognizable at a glance.

### Type Naming

| Type | Pattern | Example |
|------|---------|---------|
| UI State | `{Screen}UiState` | `LoginUiState`, `ProductDetailUiState` |
| UI Events (one-shot) | `{Screen}UiEvent` | `LoginUiEvent`, `OrderUiEvent` |
| User Actions | `{Screen}UiAction` | `LoginUiAction`, `CatalogUiAction` |
| ViewModel | `{Screen}ViewModel` | `LoginViewModel`, `ProductDetailViewModel` |
| Route composable | `{Screen}Route` | `LoginRoute`, `ProductDetailRoute` |
| Screen composable | `{Screen}Screen` | `LoginScreen`, `ProductDetailScreen` |
| Navigation route class | `{Screen}Route` (data class) | `HomeRoute`, `ProductDetailRoute` |

### Sealed Interface Convention

```kotlin
// Events and actions use sealed interface, not sealed class
sealed interface LoginUiEvent {
    data object NavigateToHome : LoginUiEvent
    data class ShowSnackbar(val message: String) : LoginUiEvent
}

sealed interface LoginUiAction {
    data class EmailChanged(val value: String) : LoginUiAction
    data object LoginClicked : LoginUiAction
}
```

MUST use `sealed interface` (not `sealed class`) for event and action hierarchies. Sealed interfaces allow implementing classes in other files and have no `copy()` overhead.

---

## Modifier and Parameter Conventions

### Modifier as First Optional Parameter

Every public composable that emits UI MUST accept `Modifier` as its first optional parameter with a default of `Modifier`:

```kotlin
// CORRECT: Modifier is first optional parameter
@Composable
fun ProductCard(
    product: ProductUiState,        // required parameters first
    onAddToCart: () -> Unit,        // required parameters
    modifier: Modifier = Modifier,  // first optional parameter
    showBadge: Boolean = false,     // other optional parameters after
) { ... }

// WRONG: Modifier buried among other parameters
@Composable
fun ProductCard(
    product: ProductUiState,
    showBadge: Boolean = false,
    modifier: Modifier = Modifier,  // should come before showBadge
    onAddToCart: () -> Unit,
) { ... }
```

MUST place `modifier: Modifier = Modifier` as the first optional parameter in all public composables. MUST NOT create composables that do not accept a `Modifier` parameter.

---

## TestTag Format

Use snake_case for all test tags. Test tags provide stable identifiers for UI tests independent of content descriptions or display text:

```kotlin
// Setting test tags
Button(
    onClick = onSubmit,
    modifier = Modifier.testTag("submit_button"),
) {
    Text("Submit")
}

LazyColumn {
    items(products, key = { it.id }) { product ->
        ProductCard(
            product = product,
            modifier = Modifier.testTag("product_item_${product.id}"),
        )
    }
}
```

```kotlin
// Using test tags in tests
composeTestRule
    .onNodeWithTag("submit_button")
    .performClick()

composeTestRule
    .onNodeWithTag("product_item_42")
    .assertIsDisplayed()
```

| Convention | Example |
|------------|---------|
| Buttons | `"submit_button"`, `"cancel_button"`, `"add_to_cart_button"` |
| List items | `"product_item_42"`, `"order_item_7"` |
| Input fields | `"email_input"`, `"password_input"` |
| Sections | `"header_section"`, `"cart_summary"` |

MUST use snake_case for all test tags. MUST NOT use content descriptions as test identifiers -- they may change with localization.

---

## File Structure

### Route Definitions

Place all `@Serializable` route definitions in a shared `:navigation` module under a `routes/` package:

```
navigation/
└── src/commonMain/kotlin/
    └── com/example/app/routes/
        ├── AuthRoutes.kt        # AuthGraph, LoginRoute, RegisterRoute
        ├── MainRoutes.kt        # HomeRoute, ProfileRoute
        ├── CatalogRoutes.kt     # CatalogRoute, ProductDetailRoute
        └── OrderRoutes.kt       # OrderRoute, CheckoutRoute
```

### Feature Module Structure

```
features/orders/
├── src/
│   ├── commonMain/kotlin/com/example/features/orders/
│   │   ├── OrdersViewModel.kt
│   │   ├── OrdersUiState.kt
│   │   ├── OrdersUiEvent.kt
│   │   └── OrdersUiAction.kt
│   └── androidMain/kotlin/com/example/features/orders/
│       ├── OrdersRoute.kt
│       ├── OrdersScreen.kt
│       └── components/
│           ├── OrderCard.kt
│           └── OrderStatusBadge.kt
└── build.gradle.kts
```

MUST keep route definitions in a shared module to prevent circular dependencies. SHOULD organize screen-specific composable components in a `components/` subdirectory within each feature.

---

## Summary

| Rule | Severity | Description |
|------|----------|-------------|
| Route/Screen split | MUST | Separate Route (ViewModel-aware) from Screen (pure composable) |
| StateFlow for state | MUST | Use `StateFlow` for persistent UI state |
| Channel for events | MUST | Use `Channel(BUFFERED)` for one-shot events (navigation, snackbar) |
| `collectAsStateWithLifecycle` | MUST | Use instead of `collectAsState()` to respect lifecycle |
| Type-safe navigation | MUST | Use `@Serializable` route classes; no string-based routes |
| Route definitions | MUST | Place `@Serializable` route classes in shared `routes/` package |
| Modifier parameter | MUST | First optional parameter, default `Modifier` |
| `sealed interface` | MUST | Use for event/action hierarchies, not `sealed class` |
| `contentDescription` | MUST | Provide for all non-decorative images and icons |
| `semantics(mergeDescendants)` | MUST | Use for composite elements read as a single unit |
| Test tags | MUST | Use snake_case format for all test tags |
| LazyColumn `key` | MUST | Provide stable unique key for all lazy list items |
| LazyColumn `contentType` | SHOULD | Set when list contains mixed item types |
| Strong skipping | SHOULD | Rely on it; avoid manual `@Stable`/`@Immutable` unless crossing module boundaries |
| `ImmutableList` | SHOULD | Use for list parameters in frequently-recomposing composables |
| `derivedStateOf` | SHOULD | Use for computed state derived from other state values |
| `rememberSaveable` | MUST | Use for UI state surviving config change and process death |
| MotionScheme | MUST | Use `MaterialTheme.motionScheme` for animations, not hardcoded specs |
| Slot-based APIs | SHOULD | Use composable lambda parameters in reusable components |
| MVI reducer | MAY | Use for screens with complex state transitions |
| Naming: `{Screen}UiState` | MUST | Follow naming conventions for state, events, actions, ViewModels |
| File structure | SHOULD | Organize components in `components/` subdirectory per feature |
