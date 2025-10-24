import 'dotenv/config'
import { atlasPool } from '../db'
import { ProjectsV2Schema } from '../src/services/projectsV2Schema'

async function main() {
  console.log('Ensuring Projects V2 schema and running one-time migration if needed...')
  await ProjectsV2Schema.ensure()
  const [a]: any = await atlasPool.query('SELECT COUNT(*) AS c FROM atlas_projects')
  const [o]: any = await atlasPool.query('SELECT COUNT(*) AS c FROM project_overrides')
  console.log('atlas_projects count:', a?.[0]?.c)
  console.log('project_overrides count:', o?.[0]?.c)
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })

