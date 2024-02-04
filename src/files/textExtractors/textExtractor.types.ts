import { Readable } from "node:stream"



export interface TextExtractor {
    getTextReaderStream(fileName: string): Readable 
}