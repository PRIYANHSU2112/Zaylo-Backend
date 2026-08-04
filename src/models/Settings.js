import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true },
    corporate: {
      title: { type: String, default: "ZAY'LO Corporate Office" },
      address: { type: String, default: '' },
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
    },
    factory: {
      title: { type: String, default: "ZAY'LO Factory" },
      address: { type: String, default: '' },
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
    },
    whatsapp: { type: String, default: '' },
    salesTeam: [
      {
        name: String,
        contact: String,
        phone: String,
      },
    ],
    brand: {
      legalName: { type: String, default: "ZAY'LO Snacks Pvt. Ltd." },
      shortDescription: { type: String, default: '' },
      logoUrl: { type: String, default: '' },
      siteUrl: { type: String, default: 'https://zaylosnacks.com' },
      ogImageUrl: { type: String, default: '' },
    },
    social: {
      instagram: { type: String, default: '' },
      facebook: { type: String, default: '' },
      youtube: { type: String, default: '' },
      linkedin: { type: String, default: '' },
      twitter: { type: String, default: '' },
      instagramHandle: { type: String, default: '@zaylosnacks' },
    },
    footer: {
      copyrightText: { type: String, default: "ZAY'LO Snacks Pvt. Ltd. All rights reserved." },
      privacyPolicyUrl: { type: String, default: '/privacy' },
      termsUrl: { type: String, default: '/terms' },
    },
    map: {
      label: { type: String, default: 'Sonipat, Haryana — Manufacturing Hub' },
      embedUrl: { type: String, default: '' },
    },
    general: {
      siteName: { type: String, default: "ZAY'LO" },
      siteTagline: { type: String, default: '' },
      themeDefault: {
        type: String,
        enum: ['emerald', 'blue', 'purple', 'orange'],
        default: 'emerald',
      },
      modeDefault: { type: String, enum: ['light', 'dark'], default: 'light' },
      allowRegistrations: { type: Boolean, default: true },
      maintenanceMode: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);

export default mongoose.model('Settings', settingsSchema);
