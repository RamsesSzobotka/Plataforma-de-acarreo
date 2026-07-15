import { mongoose } from '../db/mongo'

const settingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true })

export const Setting = mongoose.models.Setting || mongoose.model('Setting', settingSchema)
