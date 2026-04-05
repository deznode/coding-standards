---
paths:
  - apps/mobile/**/ui/**
  - "**/compose/**"
---

# Compose Patterns

> Full reference: `docs/mobile/03-compose-patterns.md`

## Route / Screen Split

Separate navigation targets (Routes) from UI content (Screens):

```kotlin
// Route -- handles ViewModel, navigation, lifecycle
@Composable
fun DashboardRoute(
    viewModel: DashboardViewModel = koinViewModel(),
    onNavigateToDetail: (String) -> Unit,
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                is DashboardEvent.NavigateToDetail -> onNavigateToDetail(event.id)
            }
        }
    }

    DashboardScreen(
        uiState = uiState,
        onAction = viewModel::onAction,
    )
}

// Screen -- pure UI, fully previewable
@Composable
fun DashboardScreen(
    uiState: DashboardUiState,
    onAction: (DashboardUiAction) -> Unit,
    modifier: Modifier = Modifier,
) {
    // UI implementation
}
```

## State and Events

Use `StateFlow` for UI state and `Channel` for one-shot events:

```kotlin
class DashboardViewModel : ViewModel() {
    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    private val _events = Channel<DashboardEvent>(Channel.BUFFERED)
    val events: Flow<DashboardEvent> = _events.receiveAsFlow()

    fun onAction(action: DashboardUiAction) {
        when (action) {
            is DashboardUiAction.Refresh -> loadData()
            is DashboardUiAction.ItemClicked -> _events.trySend(DashboardEvent.NavigateToDetail(action.id))
        }
    }
}
```

Always use `collectAsStateWithLifecycle()` over `collectAsState()` to respect the Android lifecycle and avoid collecting in the background.

## Type-Safe Navigation

```kotlin
@Serializable
data class DetailRoute(val itemId: String)

@Serializable
data object DashboardRoute

// In NavHost
composable<DetailRoute> { backStackEntry ->
    val route = backStackEntry.toRoute<DetailRoute>()
    DetailRoute(itemId = route.itemId)
}
```

Use `@Serializable` route classes for compile-time type safety. No raw string routes.

## Naming Conventions

```kotlin
// UI state -- data class
data class DashboardUiState(
    val items: List<DashboardItem> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
)

// UI actions from user -- sealed interface
sealed interface DashboardUiAction {
    data object Refresh : DashboardUiAction
    data class ItemClicked(val id: String) : DashboardUiAction
}

// One-shot events to UI -- sealed interface
sealed interface DashboardEvent {
    data class NavigateToDetail(val id: String) : DashboardEvent
    data class ShowSnackbar(val message: String) : DashboardEvent
}
```

Pattern: `{Screen}UiState`, `{Screen}UiAction`, `{Screen}Event`.

## Performance

- **Strong skipping**: enabled by default in Compose Multiplatform 1.7+
- **LazyColumn**: always provide `key {}` and `contentType {}`:

```kotlin
LazyColumn {
    items(items, key = { it.id }, contentType = { "item" }) { item ->
        ItemCard(item)
    }
}
```

- **derivedStateOf**: for computed values that change less often than their inputs:

```kotlin
val showClearButton by remember {
    derivedStateOf { searchQuery.isNotBlank() }
}
```

- **Modifier**: always the first optional parameter in composable signatures

## Key Rules

| Rule | Detail |
|------|--------|
| Route/Screen split | Route handles ViewModel + nav; Screen is pure UI |
| State collection | `collectAsStateWithLifecycle()`, never `collectAsState()` |
| One-shot events | `Channel` + `receiveAsFlow()`, collected in `LaunchedEffect` |
| Navigation | `@Serializable` route classes, no raw strings |
| Modifier param | Always first optional parameter |
| LazyColumn | Always provide `key {}` and `contentType {}` |
| Naming pattern | `{Screen}UiState`, `{Screen}UiAction`, `{Screen}Event` |
