const contentful = require("contentful-management");
const axios = require("axios");

require("dotenv").config();



// const courses = [
//   {
//     templateName: "Universal Credit Overview",
//     templateIdString: "universal_credit_overview",
//   },
//   {
//     templateName: "Using Reflective Practice",
//     templateIdString: "using_reflective_practice",
//   },
//   {
//     templateName: "Welfare Benefits for Older People",
//     templateIdString: "welfare_benefits_for_older_people",
//   },
//   // {
//   //   templateName: "Welfare Benefits Overview",
//   //   templateIdString: "welfare_benefits_overview",
//   // },
//   // {
//   //   templateName: "Welfare Benefits Update",
//   //   templateIdString: "welfare_benefits_update",
//   // },
//   // {
//   //   templateName: "Writing Homelessness Decision Letters",
//   //   templateIdString: "writing_homelessness_decision_letters",
//   // },
//   // {
//   //   templateName: "Young People and Accommodation",
//   //   templateIdString: "young_people_and_accommodation",
//   // },
// ];

const CONTENTFUL_MANAGEMENT_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
const CONTENTFUL_SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const CONTENTFUL_ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT;
const PAGE_CONTENT_TYPE = "pageCourse"; 
const DATA_CONTENT_TYPE = "dataCourse";

const createEntries = async (courses) => {
  const client = contentful.createClient({
    CONTENTFUL_MANAGEMENT_TOKEN,
  });

  try {
    const space = await client.getSpace(CONTENTFUL_SPACE_ID);
    const environment = await space.getEnvironment(CONTENTFUL_ENVIRONMENT);


    // Fetching existing entries to avoid duplicates
    const existingPageEntries = await environment.getEntries({
      content_type: PAGE_CONTENT_TYPE,
    });

    const existingPageSlugs = new Set(
      existingPageEntries.items.map((entry) => entry.fields.slug["en-GB"])
    );

    const existingDataEntries = await environment.getEntries({
      content_type: DATA_CONTENT_TYPE,
    });

    const existingTemplateIdStrings = new Set(
      existingDataEntries.items.map(
        (entry) => entry.fields.templateIdString["en-GB"]
      )
    );

    // Creating page entries
    const pageCreationPromises = courses.map(async (course) => {
      const { templateName, templateIdString } = course;

      if (existingPageSlugs.has(templateIdString)) {
        console.log(
          `Page entry with slug "${templateIdString}" already exists. Skipping.`
        );
        return null;
      }

      try {
        const pageEntry = await environment.createEntry(PAGE_CONTENT_TYPE, {
          fields: {
            title: {
              "en-GB": templateName,
            },
            slug: {
              "en-GB": templateIdString,
            },
          },
        });

        console.log(`Created page entry for ${templateName}`);
        return pageEntry;
      } catch (error) {
        console.error(
          `Error creating page entry for ${templateName}: ${error.message}`
        );
        return null;
      }
    });

    const createdPageEntries = (await Promise.all(pageCreationPromises)).filter(
      (entry) => entry !== null
    );

    console.log("All page entries created.");

    // Creating data entries
    const dataCreationPromises = [];

    for (const pageEntry of createdPageEntries) {
      const {
        fields: {
          slug: { "en-GB": templateIdString },
          title,
        },
      } = pageEntry;

      if (existingTemplateIdStrings.has(templateIdString)) {
        console.log(
          `Data entry with templateIdString "${templateIdString}" already exists. Skipping.`
        );
        continue;
      }

      const dataCreationPromise = environment.createEntry(DATA_CONTENT_TYPE, {
        fields: {
          name: {
            "en-GB": title["en-GB"],
          },
          templateIdString: {
            "en-GB": templateIdString,
          },
        },
      });

      dataCreationPromises.push(dataCreationPromise);
    }

    const createdDataEntries = await Promise.all(dataCreationPromises);

    // Linking dataCourse entries to pageCourse entries
    for (let i = 0; i < createdPageEntries.length; i++) {
      const pageEntry = createdPageEntries[i];
      const dataEntry = createdDataEntries[i];

      const {
        sys: { id: pageCourseId },
      } = pageEntry;
      const pageCourse = await environment.getEntry(pageCourseId);

      if (!pageCourse.fields.course) {
        pageCourse.fields.course = {};
      }

      pageCourse.fields.course["en-GB"] = {
        sys: {
          type: "Link",
          linkType: "Entry",
          id: dataEntry.sys.id,
        },
      };

      await pageCourse.update();

      console.log(
        `Linked dataCourse entry to pageCourse entry: ${pageEntry.fields.title["en-GB"]}`
      );
    }

    console.log("All dataCourse entries linked to pageCourse entries.");
  } catch (error) {
    console.error(`Error creating/linking entries: ${error.message}`);
  }
}


const fetchData = async () => {
  try {
    const endpoint = "http://localhost:8000/__graphql";

    const query = `
      query {
        allCourseTemplate {
          nodes {
            templateName
            templateIdString
          }
        }
      }
    `;

    const response = await axios.post(endpoint, { query });

    if (response.data && response.data.data) {
      const courses = response.data.data.allCourseTemplate.nodes;
      // console.log(response.data.data.allCourseTemplate.nodes);
      await createEntries(courses);
    } else {
      throw new Error("No data found in the response.");
    }
  } catch (error) {
    console.error(error);
  }
};

fetchData();