import { BIService } from '../services/biService';

export async function getSunburstHandler(_req, res) {
  const rows = await BIService.getCustomerProjectHours();
  const shaped = BIService.shapeSunburst(rows);
  res.json(shaped);
}
