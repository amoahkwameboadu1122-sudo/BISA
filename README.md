# BISA - Campus Marketplace

**BISA** (*Business, Ideas, Sharing and Action* / *"Let's Do Business & Share Ideas"*) is a campus marketplace that connects students with student-owned businesses, products, and services. Students can browse listings, review policy notices, view business details, and connect directly with providers.

## Project Structure

- `index.html` - Homepage with hero slideshow, search, categories, featured businesses, and footer
- `explore.html` - Browse businesses and services with filters, policy gate modal, and business details modal with slideshow
- `business.html` - Vendor registration page with policy notice modal and pending listing submission
- `about.html` - About BISA mission, vision, and community overview
- `contact.html` - Contact form and platform details
- `admin.html` - Login-protected admin portal for approving/rejecting listings, managing site settings, slideshow items, policy notices, and media uploads
- `style.css` - Shared stylesheet defining BISA theme variables, layout grids, and modals
- `assets/` - Images and brand logos

## Brand Identity & Colors

- **Brand:** BISA (*Motto: "Think. Talk. Build."*)
- **Typography:** `Montserrat`
- **Berry Plum:** `#54234A` (`--primary`)
- **Mango Gold:** `#FFB02E` (`--secondary`)
- **Hot Coral:** `#F16B4B` (`--accent`)
- **Warm Vanilla:** `#FFF1DA` (`--bg-warm`)

## Backend & Storage (Supabase)

- **Tables:** `bisa_settings` (row `id = 1`), `bisa_businesses` (`status` in `'pending'`, `'approved'`, `'rejected'`)
- **Storage Bucket:** `bisa-media` (with `localStorage` fallback)
- **Auth:** Supabase Auth (`signInWithPassword` / `signOut`) for admin access

## Development & Deployment

- **Local Development:** No build step required. Open the `.html` files using a local static server or browser.
- **Deployment:** Configured for static hosting (such as Vercel) from the repository branch.

## Assets

- `bisa-flyer.png.png` - Flyer image
- `bisa-logo-full.png` - Full logo image
- `bisa-logo-mark.png` - Logo mark image
