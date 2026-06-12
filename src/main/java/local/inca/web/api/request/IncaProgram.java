package local.inca.web.api.request;

public record IncaProgram(
        String code,
        IncaDialect dialect,
        IncaEngine backend,
        IncaQuery query
) {}
