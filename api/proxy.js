// api/proxy.js
export default async function handler(request, response) {
    // Get the image URL from the query string
    const imageUrl = request.query.url;

    if (!imageUrl) {
        return response.status(400).send('Image URL is required');
    }

    try {
        // Fetch the image from the provided URL
        const imageResponse = await fetch(imageUrl);

        // Check if the request was successful
        if (!imageResponse.ok) {
            return response.status(imageResponse.status).send('Failed to fetch image');
        }

        // Get the image data as a Blob
        const blob = await imageResponse.blob();
        const contentType = imageResponse.headers.get('content-type');

        // Set the correct CORS headers to allow access from your Vercel app
        response.setHeader('Access-Control-Allow-Origin', '*'); // For simplicity; can be locked down further
        response.setHeader('Access-Control-Allow-Methods', 'GET');

        // Set the correct content type for the image
        if (contentType) {
            response.setHeader('Content-Type', contentType);
        }

        // Send the image data back to the app
        const buffer = Buffer.from(await blob.arrayBuffer());
        response.status(200).send(buffer);

    } catch (error) {
        console.error('Error fetching image:', error);
        response.status(500).send('An error occurred while fetching the image.');
    }
}
