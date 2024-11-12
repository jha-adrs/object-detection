"use client"
import { LogUpload } from "@/actions/upload-log";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    try {
      e.preventDefault()

      if (!file) {
        alert('Please select a file to upload.')
        return
      }

      setUploading(true)

      const response = await fetch(
        process.env.NEXT_PUBLIC_BASE_URL + '/api/upload',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ filename: file.name, contentType: file.type }),
        }
      )

      if (response.ok) {
        const { url, fields } = await response.json()

        const formData = new FormData()
        Object.entries(fields).forEach(([key, value]) => {
          formData.append(key, value as string)
        })
        formData.append('file', file)

        const uploadResponse = await fetch(url, {
          method: 'POST',
          body: formData,
        })

        if (uploadResponse.ok) {
          alert('Upload successful!')
          LogUpload({
            filename: file.name,
            key: fields.key,
            inferenceStatus: "PENDING"
          });
          
        } else {
          console.error('S3 Upload Error:', uploadResponse)
          alert('Upload failed.')
        }
      } else {
        alert('Failed to get pre-signed URL.')
      }

      setUploading(false)
    } catch (error) {
      console.error('Error uploading file:', error)
    }
  }

  return (
    <main className="flex flex-col space-y-6 w-full items-center justify-center h-screen">
      <h1 className="text-3xl font-semibold">Upload a File to S3</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="file"
          type="file"
          onChange={(e) => {
            const files = e.target.files
            if (files) {
              setFile(files[0])
            }
          }}
          accept="image/png, image/jpeg"
        />
        <Button type="submit" disabled={uploading}>
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Upload'}
        </Button>
      </form>
      <footer>
        <Link href="/history">
          <Button variant={"ghost"} size={"sm"}>
            <Clock size={16} /> Recent Uploads
          </Button>
        </Link>
      </footer>
    </main>
  )
}