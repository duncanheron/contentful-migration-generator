# Contentful Entry Creation Script

This script fetches the course content that has been added to Gatsby's GraphQL data and creates both a Page - Course and Data - Course entry for each course. It then links the data entry with the page entry.

This process was originally planned to run when the site is built. Extracting it into this script will save on build time but it will need to be run every time a new course is added to Accessplanit unless the new Contentful entries are added manually.

## Variables

All these env variables should be the same as they are in the `website-assets` repo.

```
ACCESS_PLANIT_USER
ACCESS_PLANIT_PASS
CONTENTFUL_MANAGEMENT_TOKEN
CONTENTFUL_SPACE_ID
CONTENTFUL_ENVIRONMENT
```

## Usage
1. Run the `website-assets` repo at `locahost:8000` with `yarn develop`
2. Run this script: from within the courses folder `node createCourseEntries.js`
 