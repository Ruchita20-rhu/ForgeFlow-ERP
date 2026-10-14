import dotenv from 'dotenv';
dotenv.config();
if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
if(!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');
const { app } = await import('./app.js');
const port=Number(process.env.PORT||4000);
app.listen(port,()=>console.log(`ForgeFlow API listening on http://localhost:${port}`));
