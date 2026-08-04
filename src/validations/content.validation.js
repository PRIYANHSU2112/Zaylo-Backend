import joi from 'joi';

export const blogSchema = joi.object({
  title: joi.string().required(),
  excerpt: joi.string().allow(''),
  category: joi
    .string()
    .valid('Manufacturing', 'Recipes', 'Company News', 'Lifestyle', 'Products', 'Culture'),
  date: joi.string().allow(''),
  readTime: joi.string().allow(''),
  image: joi.string().allow(''),
  status: joi.string().valid('Published', 'Draft'),
});

export const gallerySchema = joi.object({
  url: joi.string().required(),
  title: joi.string().required(),
  category: joi.string().valid('Products', 'Factory', 'Events'),
});

export const announcementSchema = joi.object({
  text: joi.string().required(),
  link: joi.string().allow(''),
  position: joi.number().integer().min(0),
  status: joi.string().valid('Active', 'Inactive'),
});

export const promoSchema = joi.object({
  title: joi.string().required(),
  subtitle: joi.string().allow(''),
  cta: joi.string().allow(''),
  link: joi.string().allow(''),
  gradient: joi.string().allow(''),
  badge: joi.string().allow(''),
  imageUrl: joi.string().allow(''),
  bgImageUrl: joi.string().allow(''),
  variant: joi.string().valid('default', 'dark'),
  slot: joi.string().valid('general', 'home-festival', 'home-dealer'),
  position: joi.number().integer().min(0),
  status: joi.string().valid('Active', 'Inactive'),
});

export const landingImageSchema = joi.object({
  slot: joi.string().valid('hero', 'festival', 'dealer', 'tile', 'other').required(),
  url: joi.string().required(),
  alt: joi.string().allow(''),
  link: joi.string().allow(''),
  position: joi.number().integer().min(0),
  status: joi.string().valid('Active', 'Inactive'),
});

export const landingImageUpdateSchema = landingImageSchema.fork(['slot', 'url'], (s) => s.optional());

export const bundleSchema = joi.object({
  name: joi.string().required(),
  tagline: joi.string().allow(''),
  price: joi.number().min(0).required(),
  mrp: joi.number().min(0).required(),
  productIds: joi.array().items(joi.string()).default([]),
  position: joi.number().integer().min(0),
  status: joi.string().valid('Active', 'Inactive'),
});

export const bundleUpdateSchema = bundleSchema.fork(['name', 'price', 'mrp'], (s) => s.optional());
