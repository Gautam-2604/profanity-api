import { Index } from '@upstash/vector'
import csv from 'csv-parser'
import fs from 'fs'
import { Transform } from 'stream'
import "dotenv/config"

const index = new Index({
  url: process.env.VECTOR_URL,
  token: process.env.VECTOR_TOKEN,
})

interface Row {
  text: string
}

function createLineRangeStream(startLine: number, endLine: number) {
  let currentLine = 0
  return new Transform({
    transform(chunk: any, _: any, callback: () => void) {
      if (currentLine >= startLine && currentLine < endLine) {
        this.push(chunk)
      }
      currentLine++
      if (currentLine >= endLine) {
        this.push(null)
      }
      callback()
    },
    objectMode: true,
  })
}

async function parseCSV(
  filePath: string,
  startLine: number,
  endLine: number
): Promise<Row[]> {
  return new Promise((resolve, reject) => {
    const rows: Row[] = []

    fs.createReadStream(filePath)
      .pipe(csv({ separator: ',' }))
      .pipe(createLineRangeStream(startLine, endLine))
      .on('data', (row: Row) => {
        rows.push(row)
      })
      .on('error', (error: any) => {
        reject(error)
      })
      .on('end', () => {
        resolve(rows)
      })
  })
}

const STEP = 30

const seed = async () => {
  for (let i = 0; i < 1464; i += STEP) {
    const start = i
    const end = i + STEP

    const data = await parseCSV('training_dataset.csv', start, end)

    const formatted = data.map((row, batchIndex) => ({
      data: row.text,
      id: i + batchIndex,
      metadata: { text: row.text },
    }))

    await index.upsert(formatted)
  }
}

seed()