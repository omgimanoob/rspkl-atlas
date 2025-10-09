// index.ts
import express from 'express';
import { getProjectsHandler, getDetailedTimesheetsHandler } from './controllers/projectsController';
import { syncTimesheetsHandler } from './controllers/syncController';
import { getSunburstHandler } from './controllers/biController';
import { updateProjectStatusHandler } from './controllers/projectOverridesController';


const app = express();
const port = Number(process.env.PORT) || 8888;
const onServerStart  = () => {
    console.log(`RSPKL Atlas API listening at http://localhost:${port}`);
}
app.use(express.json());

app.use(express.static('public')); // ✅ Serve index.html, ECharts, etc.

app.put('/overrides/status', updateProjectStatusHandler);
app.get('/bi/sunburst', getSunburstHandler);
app.get('/projects', getProjectsHandler);
app.get('/timesheets', getDetailedTimesheetsHandler);
app.post('/sync/timesheets', syncTimesheetsHandler);
app.listen(port, onServerStart);
