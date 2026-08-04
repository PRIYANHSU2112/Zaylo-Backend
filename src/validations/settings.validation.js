import joi from 'joi';

const officeSchema = joi.object({
  title: joi.string().allow(''),
  address: joi.string().allow(''),
  phone: joi.string().allow(''),
  email: joi.string().allow(''),
});

const salesMemberSchema = joi.object({
  name: joi.string().allow(''),
  contact: joi.string().allow(''),
  phone: joi.string().allow(''),
});

export const settingsUpdateSchema = joi
  .object({
    corporate: officeSchema,
    factory: officeSchema,
    whatsapp: joi.string().allow(''),
    salesTeam: joi.array().items(salesMemberSchema),
    brand: joi.object({
      legalName: joi.string().allow(''),
      shortDescription: joi.string().allow(''),
      logoUrl: joi.string().allow(''),
      siteUrl: joi.string().allow(''),
      ogImageUrl: joi.string().allow(''),
    }),
    social: joi.object({
      instagram: joi.string().allow(''),
      facebook: joi.string().allow(''),
      youtube: joi.string().allow(''),
      linkedin: joi.string().allow(''),
      twitter: joi.string().allow(''),
      instagramHandle: joi.string().allow(''),
    }),
    footer: joi.object({
      copyrightText: joi.string().allow(''),
      privacyPolicyUrl: joi.string().allow(''),
      termsUrl: joi.string().allow(''),
    }),
    map: joi.object({
      label: joi.string().allow(''),
      embedUrl: joi.string().allow(''),
    }),
    general: joi.object({
      siteName: joi.string().allow(''),
      siteTagline: joi.string().allow(''),
      themeDefault: joi.string().valid('emerald', 'blue', 'purple', 'orange'),
      modeDefault: joi.string().valid('light', 'dark'),
      allowRegistrations: joi.boolean(),
      maintenanceMode: joi.boolean(),
    }),
  })
  .min(1);
