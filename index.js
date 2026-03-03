const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE = process.env.AIRTABLE_TABLE;
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;

async function getApprovedUnexpiredPods() {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
  });
  const data = await res.json();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const validPods = new Set();
  for (const record of data.records) {
    const f = record.fields;
    const approved = f["Approved"] === true;
    const expiry = f["Date of Expiry"] ? new Date(f["Date of Expiry"]) : null;
    const podId = f["Name of Pod"];
    if (approved && expiry && expiry >= today && podId) {
      validPods.add(podId);
    }
  }
  return validPods;
}

async function getAllRunningPods() {
  const res = await fetch("https://rest.runpod.io/v1/pods", {
    headers: { Authorization: `Bearer ${RUNPOD_API_KEY}` }
  });
  const data = await res.json();
  return data; // array of pods
}

async function deletePod(podId) {
  const res = await fetch(`https://rest.runpod.io/v1/pods/${podId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${RUNPOD_API_KEY}` }
  });
  return res.ok;
}

async function main() {
  console.log("Starting pod cleanup...");

  const validPods = await getApprovedUnexpiredPods();
  console.log(`Valid pods from Airtable: ${[...validPods].join(", ") || "none"}`);

  const runningPods = await getAllRunningPods();
  console.log(`Running pods on RunPod: ${runningPods.map(p => p.id).join(", ") || "none"}`);

  for (const pod of runningPods) {
    if (!validPods.has(pod.id)) {
      console.log(`Deleting pod ${pod.id} (not approved or expired)...`);
      const success = await deletePod(pod.id);
      console.log(success ? `✅ Deleted ${pod.id}` : `❌ Failed to delete ${pod.id}`);
    } else {
      console.log(`✅ Keeping pod ${pod.id} (approved and unexpired)`);
    }
  }

  console.log("Cleanup complete.");
}

main().catch(console.error);
