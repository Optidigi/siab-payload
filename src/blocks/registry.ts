import { Hero } from "./Hero"
import { FeatureList } from "./FeatureList"
import { Testimonials } from "./Testimonials"
import { FAQ } from "./FAQ"
import { CTA } from "./CTA"
import { RichText } from "./RichText"
import { ContactSection } from "./ContactSection"

export const BLOCKS = [Hero, FeatureList, Testimonials, FAQ, CTA, RichText, ContactSection] as const

export const blockBySlug = Object.fromEntries(BLOCKS.map((b) => [b.slug, b])) as Record<string, (typeof BLOCKS)[number]>
