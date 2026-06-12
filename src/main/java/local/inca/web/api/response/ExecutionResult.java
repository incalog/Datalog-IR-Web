package local.inca.web.api.response;

import java.util.List;

public record ExecutionResult(
        String relation,
        int arity,
        int size,
        List<String> columns,
        List<List<Object>> rows
) {
}
