package {{API_PACKAGE}}.shared.api

import org.springframework.data.domain.Page
import java.time.Instant

/**
 * Standard API response wrapper for successful responses.
 * Provides consistent response format across all endpoints.
 *
 * @param T The type of the response data
 * @property data The actual response data
 * @property timestamp When the response was generated
 * @property status HTTP status code
 */
data class ApiResult<T>(
    val data: T,
    val timestamp: Instant = Instant.now(),
    val status: Int = 200,
)

/**
 * Paginated API response wrapper for list endpoints.
 * Follows Spring Data Page structure with data and pagination metadata.
 *
 * @param T The type of the data items
 * @property data List of items for current page
 * @property pageable Pagination metadata
 * @property timestamp When the response was generated
 * @property status HTTP status code
 */
data class PagedApiResult<T : Any>(
    val data: List<T>,
    val pageable: PageableInfo,
    val timestamp: Instant = Instant.now(),
    val status: Int = 200,
) {
    companion object {
        /**
         * Creates a PagedApiResult from a Spring Data Page object.
         */
        fun <T : Any> from(page: Page<T>): PagedApiResult<T> =
            PagedApiResult(
                data = page.content,
                pageable =
                    PageableInfo(
                        page = page.number,
                        size = page.size,
                        totalElements = page.totalElements,
                        totalPages = page.totalPages,
                        first = page.isFirst,
                        last = page.isLast,
                    ),
            )
    }
}

/**
 * Pagination metadata information.
 */
data class PageableInfo(
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int,
    val first: Boolean,
    val last: Boolean,
)
