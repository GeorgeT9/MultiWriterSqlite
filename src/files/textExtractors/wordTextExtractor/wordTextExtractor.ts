import { Readable } from "node:stream"
import WordExtractor from "word-extractor"


async function* textFromWordDocument(fileName: string) {
    const doc =  await new WordExtractor().extract(fileName)
    const text = [
        doc.getHeaders({includeFooters: false}).trim(),
        doc.getBody().trim(), 
        doc.getFootnotes().trim(),
        doc.getEndnotes().trim(),
        doc.getFooters().trim()
    ].join('\n')  
    yield text
}

export const wordTextExtractor = (fileName: string) => Readable.from(textFromWordDocument(fileName))