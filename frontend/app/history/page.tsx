import { getUploads } from '@/actions/get-uploads';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, Loader2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import React, { Suspense } from 'react';

interface pageProps {

}

const page = async ({ }: pageProps) => {
    const uploads = await getUploads();
    return (
        <main className="flex flex-col space-y-6 w-full items-center justify-center ">
            <Link href="/">
                <Button variant={"ghost"} size={"sm"}>
                    <ChevronLeft size={16} /> Back to Upload
                </Button>
            </Link>
            <h1 className="text-3xl font-semibold">Recent Uploads and Inference Results</h1>
            <Suspense fallback={<LoadingSkeleton />}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full p-4">
                    {
                        uploads.data.map((upload, index) => {
                            return (
                                <>
                                    <div className="flex w-full aspect-square h-64 border rounded-md col-span-1">
                                        <img src={upload.file} alt="upload" className="aspect-auto object-contain rounded-lg" />
                                    </div>
                                    <div className="flex w-full aspect-square h-64 border rounded-md col-span-1 items-center justify-center">
                                        {/* <h2 className="text-xl font-semibold">Upload ID: {upload.id}</h2> */}
                                        {/* <p className="text-sm">File: {upload.file}</p> */}
                                        {
                                            upload.inference_url ? (
                                                <img src={upload.inference_url} alt="inference" className="w-full h-64 object-contain rounded-lg" />
                                            ) : (
                                                <Skeleton className="w-full h-64 rounded-lg" />
                                            )
                                        }
                                    </div>

                                </>
                            )
                        })
                    }
                </div>
            </Suspense>
        </main>
    )
}

export default page;

const LoadingSkeleton = () => {
    return (
        <div className="flex flex-col gap-4">
            <Loader2 size={32} className='animate-spin' />
        </div>
    )
}