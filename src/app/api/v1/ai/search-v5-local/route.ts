import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const STREAM_PREFIX =
  "__V5_EVENT__";

type Obj =
  Record<
    string,
    unknown
  >;

function isObj(
  value: unknown
): value is Obj {
  return (
    !!value &&
    typeof value ===
      "object" &&
    !Array.isArray(value)
  );
}

export async function POST(
  req: Request
) {
  /*
   * Sécurité absolue :
   * cette route est réservée
   * au serveur Next local.
   */
  if (
    process.env.NODE_ENV !==
      "development"
  ) {
    return Response.json(
      {
        ok: false,
        error:
          "local_v5_disabled",
      },
      {
        status: 404,
      }
    );
  }

  const body =
    await req
      .json()
      .catch(
        () => null
      );

  const query =
    String(
      body?.query ?? ""
    ).trim();

  if (!query) {
    return Response.json(
      {
        ok: false,
        error:
          "missing_query",
      },
      {
        status: 400,
      }
    );
  }

  const cwd =
    process.cwd();

  const placesPath =
    path.join(
      cwd,
      "data",
      "places.json"
    );

  const rawPlaces =
    JSON.parse(
      await fs.promises
        .readFile(
          placesPath,
          "utf8"
        )
    );

  const places =
    Array.isArray(
      rawPlaces
    )
      ? rawPlaces
      : [];

  const placeById =
    new Map<
      string,
      Obj
    >();

  for (
    const value of places
  ) {
    if (!isObj(value)) {
      continue;
    }

    const id =
      String(
        value.id ?? ""
      );

    if (id) {
      placeById.set(
        id,
        value
      );
    }
  }

  function enrichResult(
    value: unknown
  ) {
    if (!isObj(value)) {
      return value;
    }

    const id =
      String(
        value.id ?? ""
      );

    const place =
      placeById.get(id);

    if (!place) {
      return value;
    }

    return {
      ...place,
      ...value,
    };
  }

  const tmpDir =
    path.join(
      cwd,
      "tmp"
    );

  await fs.promises.mkdir(
    tmpDir,
    {
      recursive: true,
    }
  );

  const inputPath =
    path.join(
      tmpDir,
      `v5-local-${randomUUID()}.json`
    );

  await fs.promises.writeFile(
    inputPath,
    JSON.stringify(
      [query]
    ),
    "utf8"
  );

  const tsxBin =
    path.join(
      cwd,
      "node_modules",
      ".bin",
      "tsx"
    );

  const child =
    spawn(
      tsxBin,
      [
        "scripts/search-ai-v5-simple.ts",
        inputPath,
      ],
      {
        cwd,
        env: {
          ...process.env,
          V5_SIMPLE_STREAM_JSON:
            "1",

          V5_SIMPLE_LOCAL_ONLY:
            "1",
        },
        stdio: [
          "ignore",
          "pipe",
          "pipe",
        ],
      }
    );

  const encoder =
    new TextEncoder();

  let closed =
    false;

  let stdoutBuffer =
    "";

  let stderrBuffer =
    "";

  const cleanup =
    async () => {
      await fs.promises
        .unlink(inputPath)
        .catch(
          () => {}
        );
    };

  const stream =
    new ReadableStream<
      Uint8Array
    >({
      start(
        controller
      ) {
        function send(
          value: unknown
        ) {
          if (closed) {
            return;
          }

          controller.enqueue(
            encoder.encode(
              JSON.stringify(
                value
              ) + "\n"
            )
          );
        }

        function consumeLine(
          line: string
        ) {
          if (
            !line.startsWith(
              STREAM_PREFIX
            )
          ) {
            return;
          }

          const json =
            line.slice(
              STREAM_PREFIX.length
            );

          try {
            const event =
              JSON.parse(json);

            if (
              event?.type ===
                "results" &&
              Array.isArray(
                event.results
              )
            ) {
              send({
                type:
                  "results",
                phase:
                  event.phase ??
                  "unknown",
                results:
                  event.results.map(
                    enrichResult
                  ),
              });

              return;
            }

            if (
              event?.type ===
              "done"
            ) {
              send({
                type:
                  "done",

                results:
                  Array.isArray(
                    event.results
                  )
                    ? event.results.map(
                        enrichResult
                      )
                    : [],
              });
            }
          } catch (
            error
          ) {
            console.error(
              "[search-v5-local] event parse error",
              error
            );
          }
        }

        child.stdout.on(
          "data",
          (
            chunk:
              Buffer
          ) => {
            stdoutBuffer +=
              chunk.toString(
                "utf8"
              );

            const lines =
              stdoutBuffer.split(
                "\n"
              );

            stdoutBuffer =
              lines.pop() ??
              "";

            for (
              const line of
              lines
            ) {
              consumeLine(
                line
              );
            }
          }
        );

        child.stderr.on(
          "data",
          (
            chunk:
              Buffer
          ) => {
            stderrBuffer +=
              chunk.toString(
                "utf8"
              );
          }
        );

        child.on(
          "error",
          async (
            error
          ) => {
            console.error(
              "[search-v5-local] child error",
              error
            );

            send({
              type:
                "error",
              error:
                "v5_process_error",
            });

            closed =
              true;

            controller.close();

            await cleanup();
          }
        );

        child.on(
          "close",
          async (
            code
          ) => {
            if (
              stdoutBuffer
            ) {
              consumeLine(
                stdoutBuffer
              );
            }

            if (
              code !== 0 &&
              !closed
            ) {
              console.error(
                "[search-v5-local] V5 exited",
                code,
                stderrBuffer.slice(
                  -4000
                )
              );

              send({
                type:
                  "error",
                error:
                  "v5_failed",
              });
            }

            if (!closed) {
              closed =
                true;

              controller.close();
            }

            await cleanup();
          }
        );
      },

      async cancel() {
        if (
          !child.killed
        ) {
          child.kill(
            "SIGTERM"
          );
        }

        closed =
          true;

        await cleanup();
      },
    });

  return new Response(
    stream,
    {
      headers: {
        "Content-Type":
          "application/x-ndjson; charset=utf-8",

        "Cache-Control":
          "no-store, no-transform",

        "X-Indie-Map-Engine":
          "v5-simple-local",
      },
    }
  );
}
