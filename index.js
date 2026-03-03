const http = require("http");

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET; // optional but recommended

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/delete-pod") {
    res.writeHead(404);
    return res.end("Not found");
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const data = JSON.parse(body);

      // Optional: verify secret
      if (WEBHOOK_SECRET && data.secret !== WEBHOOK_SECRET) {
        res.writeHead(401);
        return res.end("Unauthorized");
      }

      const podId = data.podId;
      if (!podId) {
        res.writeHead(400);
        return res.end("Missing podId");
      }

      console.log(`Deleting pod: ${podId}`);

      const response = await fetch(`https://rest.runpod.io/v1/pods/${podId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${RUNPOD_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        console.log(`Pod ${podId} deleted successfully`);
        res.writeHead(200);
        res.end(`Pod ${podId} deleted`);
      } else {
        const errorText = await response.text();
        console.error(`Failed to delete pod: ${errorText}`);
        res.writeHead(500);
        res.end(`Failed to delete pod: ${errorText}`);
      }
    } catch (err) {
      console.error(err);
      res.writeHead(500);
      res.end("Server error");
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
