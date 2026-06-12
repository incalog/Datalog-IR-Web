package local.inca.web.api;

import local.inca.web.api.request.IncaProgram;
import local.inca.web.api.response.ApiResult;
import local.inca.web.inca.IncaRuntimeService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/inca")
public class IncaController {
    private final IncaRuntimeService incaRuntimeService;

    public IncaController(IncaRuntimeService incaRuntimeService) {
        this.incaRuntimeService = incaRuntimeService;
    }

    @PostMapping("/execute")
    public ResponseEntity<ApiResult<?>> execute(@RequestBody IncaProgram prog) {
        try {
            var execRes = incaRuntimeService.execute(prog);
            System.out.println(execRes);
            var res = ApiResult.success(execRes);
            return new ResponseEntity<>(res, HttpStatus.OK);
        } catch(Exception e) {
            var res = ApiResult.failure(e.getMessage());
            return new ResponseEntity<>(res, HttpStatus.BAD_REQUEST);
        }
    }
}
