import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { JsonPipe } from '@angular/common';

type IncaDialect = 'Datalog' | 'FunctionalInca' | 'OODL' | 'Souffle';
type IncaEngine = 'Viatra' | 'Souffle' | 'Interpreter' | 'DDLog' | 'Ascent';
type IrKind = 'lowered' | 'optimized';
type IrMode = 'hidden' | IrKind;

interface IncaQuery {
  relName: string;
  args: unknown[];
}

interface IncaProgramRequest {
  code: string;
  dialect: IncaDialect;
  backend: IncaEngine;
  query: IncaQuery | null;
}

interface ExecutionResult {
  relation: string;
  arity: number;
  size: number;
  columns: string[];
  rows: unknown[][];
}

interface ApiResult<T> {
  result: T | null;
  error: string | null;
}

@Component({
  selector: 'app-root',
  imports: [FormsModule, JsonPipe],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly dialects: IncaDialect[] = ['Datalog', 'FunctionalInca', 'OODL', 'Souffle'];
  protected readonly backends: IncaEngine[] = ['Viatra', 'Souffle', 'Interpreter', 'DDLog', 'Ascent'];
  private readonly sampleFiles: Record<IncaDialect, string> = {
    Datalog: '/resources/datalog_sample.dl',
    FunctionalInca: '/resources/functional_sample.finca',
    OODL: '/resources/oodl_sample.oodl',
    Souffle: '/resources/souffle_sample.dl'
  };
  private readonly sampleQueries: Record<IncaDialect, string> = {
    Datalog: 'path(1, ?)',
    FunctionalInca: 'main(5)',
    OODL: 'main(5)',
    Souffle: 'path(1, ?)'
  };

  protected readonly dialect = signal<IncaDialect>('Datalog');
  protected readonly backend = signal<IncaEngine>('Interpreter');
  protected readonly code = signal(`.decl R(x: number, y: number)\nR(1, 4).\nR(2, 4).`);
  protected readonly queryText = signal('R(?, 4)');

  protected readonly isRunning = signal(false);
  protected readonly result = signal<ExecutionResult | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly isLoadingIr = signal(false);
  protected readonly activeIrMode = signal<IrMode>('hidden');
  protected readonly activeIrKind = signal<IrKind | null>(null);
  protected readonly irCode = signal<string | null>(null);
  protected readonly irError = signal<string | null>(null);
  protected readonly showParsedQuery = signal(false);
  private sampleLoadId = 0;
  private irLoadId = 0;
  protected previewQuery(): IncaQuery | null {
    try {
      return this.parseQuery(this.queryText());
    } catch {
      return null;
    }
  }

  constructor(private readonly http: HttpClient) {
    this.loadDialectSample(this.dialect());
  }

  protected onDialectSelect(event: Event): void {
    const dialect = (event.target as HTMLSelectElement).value as IncaDialect;
    this.dialect.set(dialect);
    this.loadDialectSample(dialect);
  }

  protected updateBackend(backend: IncaEngine): void {
    this.backend.set(backend);
    this.clearIr();
  }

  protected updateCode(code: string): void {
    this.code.set(code);
    this.clearIr();
  }

  protected updateQueryText(queryText: string): void {
    this.queryText.set(queryText);
  }

  protected runProgram(): void {
    this.error.set(null);
    this.result.set(null);

    let query: IncaQuery;
    try {
      query = this.parseQuery(this.queryText());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Invalid query.');
      return;
    }

    const payload: IncaProgramRequest = {
      code: this.code(),
      dialect: this.dialect(),
      backend: this.backend(),
      query
    };

    this.isRunning.set(true);
    this.http.post<ApiResult<ExecutionResult>>('/api/inca/execute', payload).subscribe({
      next: (response) => {
        if (response.error) {
          this.error.set(response.error);
        } else {
          this.result.set(response.result);
        }
        this.isRunning.set(false);
      },
      error: (response) => {
        this.error.set(response.error?.error ?? 'Could not execute the program. Check that Spring Boot is running.');
        this.isRunning.set(false);
      }
    });
  }

  protected selectIrMode(mode: IrMode): void {
    if (mode === 'hidden') {
      this.hideIr();
      return;
    }

    this.loadIr(mode);
  }

  private loadIr(kind: IrKind): void {
    const loadId = ++this.irLoadId;
    const payload: IncaProgramRequest = {
      code: this.code(),
      dialect: this.dialect(),
      backend: this.backend(),
      query: this.previewQuery()
    };

    this.activeIrMode.set(kind);
    this.activeIrKind.set(kind);
    this.isLoadingIr.set(true);
    this.irCode.set(null);
    this.irError.set(null);

    this.http.post<ApiResult<string>>(`/api/inca/${kind}`, payload).subscribe({
      next: (response) => {
        if (this.irLoadId !== loadId) {
          return;
        }

        if (response.error) {
          this.irError.set(response.error);
        } else {
          this.irCode.set(response.result ?? '');
        }
        this.isLoadingIr.set(false);
      },
      error: (response) => {
        if (this.irLoadId !== loadId) {
          return;
        }

        this.irError.set(response.error?.error ?? `Could not load ${kind} IR.`);
        this.isLoadingIr.set(false);
      }
    });
  }

  private loadDialectSample(dialect: IncaDialect): void {
    const loadId = ++this.sampleLoadId;
    this.queryText.set(this.sampleQueries[dialect]);
    this.code.set(`Loading ${dialect} sample...`);
    this.error.set(null);
    this.result.set(null);
    this.clearIr();

    this.http.get(`${this.sampleFiles[dialect]}?load=${loadId}`, { responseType: 'text' }).subscribe({
      next: (sample) => {
        if (this.sampleLoadId === loadId && this.dialect() === dialect) {
          this.code.set(sample);
        }
      },
      error: () => {
        if (this.sampleLoadId === loadId && this.dialect() === dialect) {
          this.code.set('');
          this.error.set(`Could not load sample file for ${dialect}.`);
        }
      }
    });
  }

  protected toggleParsedQuery(): void {
    this.showParsedQuery.update((isOpen) => !isOpen);
  }

  private clearIr(): void {
    this.irLoadId++;
    this.isLoadingIr.set(false);
    this.activeIrMode.set('hidden');
    this.activeIrKind.set(null);
    this.irCode.set(null);
    this.irError.set(null);
  }

  private hideIr(): void {
    this.irLoadId++;
    this.isLoadingIr.set(false);
    this.activeIrMode.set('hidden');
    this.activeIrKind.set(null);
  }

  protected formatCell(value: unknown): string {
    if (value === null) {
      return '?';
    }

    if (typeof value === 'string') {
      return value;
    }

    return JSON.stringify(value);
  }

  private parseQuery(input: string): IncaQuery {
    const trimmed = input.trim();
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)$/.exec(trimmed);

    if (!match) {
      throw new Error('Query must look like R(?, 4) or main(1, "A").');
    }

    return {
      relName: match[1],
      args: this.parseArguments(match[2])
    };
  }

  private parseArguments(input: string): unknown[] {
    if (input.trim() === '') {
      return [];
    }

    return this.splitArguments(input).map((value) => this.parseArgument(value.trim()));
  }

  private splitArguments(input: string): string[] {
    const args: string[] = [];
    let current = '';
    let quote: '"' | "'" | null = null;
    let escaped = false;

    for (const char of input) {
      if (escaped) {
        current += char;
        escaped = false;
        continue;
      }

      if (char === '\\' && quote) {
        current += char;
        escaped = true;
        continue;
      }

      if ((char === '"' || char === "'") && !quote) {
        quote = char;
        current += char;
        continue;
      }

      if (char === quote) {
        quote = null;
        current += char;
        continue;
      }

      if (char === ',' && !quote) {
        args.push(current);
        current = '';
        continue;
      }

      current += char;
    }

    if (quote) {
      throw new Error('Query contains an unterminated string literal.');
    }

    args.push(current);
    return args;
  }

  private parseArgument(value: string): unknown {
    if (value === '?') {
      return null;
    }

    if (/^-?\d+$/.test(value)) {
      return Number.parseInt(value, 10);
    }

    if (/^-?\d+\.\d+$/.test(value)) {
      return Number.parseFloat(value);
    }

    const quoted = /^(?:"((?:\\.|[^"])*)"|'((?:\\.|[^'])*)')$/.exec(value);
    if (quoted) {
      return (quoted[1] ?? quoted[2]).replace(/\\([\\"'])/g, '$1');
    }

    if (value.length === 0) {
      throw new Error('Query contains an empty argument.');
    }

    return value;
  }
}
