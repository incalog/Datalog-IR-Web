package local.inca.web.api.response;

public record ApiResult<T>(
        T result,
        String error
) {
    public static <T> ApiResult<T> success(T result) {
        return new ApiResult<>(result, null);
    }

    public static <T> ApiResult<T> failure(String message) {
        return new ApiResult<>(null, message);
    }
}
