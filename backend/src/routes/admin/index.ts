import { Hono } from 'hono/tiny'
import stats from './stats'
import users from './users'
import drivers from './drivers'
import rides from './rides'

const app = new Hono()

app.route('/stats', stats)
app.route('/users', users)
app.route('/drivers', drivers)
app.route('/rides', rides)

export default app