import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => c.text('Whatflow Worker is running!'))

export default app
