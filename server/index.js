import "dotenv/config";
import app from "./app.js";

const port = Number(process.env.PORT || 4312);

app.listen(port, "0.0.0.0", () => {
  console.log(`RepairScout API running on http://localhost:${port}`);
});
