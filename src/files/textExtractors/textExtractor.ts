import { extname } from "node:path"
import { createReadStream } from "node:fs"
import { wordTextExtractor } from "./wordTextExtractor/wordTextExtractor"


export function getTextExtractorFromFile(fileName: string) {
    switch (extname(fileName)) {
        case '.doc':
        case '.docx':
            return wordTextExtractor(fileName)
        case '.csv':
        case '.txt':
            return createReadStream(fileName, {highWaterMark: 8*1024})
        default:
            throw new Error(`Текстовый экстрактор для файл ${fileName} не определен`)
    }
}