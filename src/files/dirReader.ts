import { opendir, stat } from "node:fs/promises"
import { extname, resolve, relative } from "node:path"


type FileInfo = {
    fileName: string,
    mTimeMs: number,
    sizeKb: number
}

/**
 * Создает итератор, который обходит все файлы из директории path и
 * возвращает FileInfo, чье время модификации больше afterMTimeMs и 
 * расширение принадлежит списку onlyThisExts;
 * fileName содержит путь относительно параметра path
 */
export async function* genFileNamesFromDir(path: string, afterMTimeMs: number, onlyThisExts: string[] ): AsyncGenerator<FileInfo> {
    const dir = await opendir(path, {recursive: true})
    const exts = new Set(onlyThisExts)
    for await (const f of dir ) {
        if (f.isFile()) {
            const fileFullName = resolve(f.path, f.name) 
            const { mtimeMs, size } = await stat(fileFullName)
            if (exts.has(extname(f.name)) && mtimeMs > afterMTimeMs) {
                yield {
                    fileName: relative(path, fileFullName),
                    mTimeMs: mtimeMs,
                    sizeKb: Math.round(size / 1024)
                }
            }
        }
    }
}

