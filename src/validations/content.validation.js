import { BANNER_PLACEMENTS, LEGACY_SLOTS } from '../utils/banners.js';
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

export const promoSchema = joi
  .object({
    title: joi.string().trim().max(120).allow(''),
    subtitle: joi.string().trim().max(240).allow(''),
    cta: joi.string().trim().max(40).allow(''),
    link: joi.string().trim().max(300).allow(''),
    gradient: joi.string().allow(''),
    badge: joi.string().trim().max(40).allow(''),
    imageUrl: joi.string().allow(''),
    mobileImageUrl: joi.string().allow(''),
    bgImageUrl: joi.string().allow(''),
    variant: joi.string().valid('default', 'dark'),
    slot: joi.string().valid(...BANNER_PLACEMENTS, ...LEGACY_SLOTS),
    startsAt: joi.date().allow(null),
    endsAt: joi.date().allow(null),
    position: joi.number().integer().min(0),
    status: joi.string().valid('Active', 'Inactive'),
  })
  .custom((value, helpers) => {
    if (value.startsAt && value.endsAt && new Date(value.endsAt) < new Date(value.startsAt)) {
      return helpers.message('End date must be after the start date');
    }
    return value;
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
  productIds: joi.array().items(joi.string().hex().length(24)).min(1).max(20).required(),
  position: joi.number().integer().min(0),
  status: joi.string().valid('Active', 'Inactive'),
});

export const bundleUpdateSchema = bundleSchema.fork(['name', 'price', 'mrp', 'productIds'], (s) => s.optional());
