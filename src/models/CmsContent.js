import mongoose from 'mongoose';

/** CMS content for storefront. */
const cmsContentSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'home', unique: true },
    about: {
      story: { type: String, default: '' },
      mission: { type: String, default: '' },
      vision: { type: String, default: '' },
      timeline: [{ year: String, title: String, desc: String }],
      values: [{ title: String, desc: String }],
      awards: [{ type: String }],
    },
    testimonials: [
      {
        name: String,
        role: String,
        rating: { type: Number, default: 5 },
        text: String,
        avatar: String,
        position: { type: Number, default: 0 },
      },
    ],
    trustedBy: [{ type: String }],
    faqs: [{ q: String, a: String }],
    dealerFaqs: [{ q: String, a: String }],
    dealerBenefits: [{ title: String, desc: String }],
    whyChoose: [
      {
        title: String,
        description: String,
        icon: String,
      },
    ],
    trustStats: [
      {
        value: String,
        label: String,
      },
    ],
  },
  { timestamps: true },
);

export default mongoose.model('CmsContent', cmsContentSchema);
