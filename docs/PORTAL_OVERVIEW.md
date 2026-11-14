# Tessellum: portal overview

Tessellum is a free, bilingual (Arabic and English) research platform for media, communication and social science researchers, many of them postgraduate students. A researcher can build a study from several tools and share one link with participants.

**Status (November 2026):** the items marked *Working* run in the prototype. Items marked *In development* are not finished and should not be presented as available.

## Principles

- **Free for researchers.** No tiers and no paywalls.
- **Bilingual.** Arabic and English, with right-to-left layout for Arabic.
- **Data stays under the researcher's control.** Analysis runs on the researcher's own device. No data is collected from social media platforms.
- **Measures behaviour, not just opinions.** Studies record what participants do, not only what they say.

## Home

The homepage presents the five tools and links to each. It is available in both languages at `/en` and `/ar`.

## Tool 1: Shopping village (3D) · *Working*

A walkable 3D street that participants move through with a tap, a drag or the arrow keys.

- **Eleven scenes** to choose from: garden village, futuristic district, shopping mall, strip mall, souq, food court, supermarket aisle, waterfront, airport duty-free, night market and luxury boulevard.
- **The researcher sets the stores and products.** The place changes between scenes, but the stores, offers and recorded events stay the same, so results compare across scenes.
- **Participants enter stores** by tapping them. Inside, they add products to a bag, and every action is recorded.
- **Avatars are assigned automatically** from the participant's own answer. A participant who prefers not to say is shown as a neutral circle of light, with no body or gender.
- **Recorded:** approaching and entering stores, dwell time, product views, bag changes and purchases.

## Tool 2: E-commerce simulator · *Working*

A realistic online shop for studying shopping behaviour.

- **Layout:** a marketplace (many brands together) or a single-brand store. The researcher chooses.
- **Shopping:** search, filters, sorting, product pages with photos, prices, original prices, offers and reviews.
- **Advertising:** banners and sponsored products, placed where the researcher chooses.
- **Checkout is simulated.** No real payment is taken and no order is placed.
- **Variables the researcher can change between groups:** prices and offers, ads and sponsored items, ratings and reviews, and product order.
- **Recorded:** searches, filter use, product views, basket changes, checkout, ad impressions and scroll depth.

## Tool 3: Forms · *Working*

A form builder in the style of Google Forms and SharePoint Forms, with Tessellum's own design.

- **Questions:** short and long text, single choice, multiple choice, dropdown, scales (Likert and semantic differential), sliders, matrices, ranking, numbers, dates and picture choice.
- **Layout:** one long page for participants. Each form is in one language.
- **Skip logic:** a question appears only when an earlier answer calls for it. A screening rule can end the study politely.
- **Media:** images and video on any question or option. Participants can tap an image to enlarge it.
- **Attention checks:** a question can have a correct answer, and wrong answers are flagged in the export.
- **Theme:** a colour and a header image.

## The studio: one study, one link · *Working*

A researcher creates a study from any mix of forms, the village and the shop, in any order. Participants receive one link. The studio keeps a list of studies and their status (draft or published).

## Responses and exports · *Working*

- **Summary charts** for each question, updating as responses arrive.
- **Individual responses**, one participant at a time.
- **Table view** of all participants.
- **Downloads:** a participant-level CSV, an event log CSV, a codebook CSV, and SPSS syntax that applies labels to the data. Arabic text is kept intact.

## Tool 4: Sentiment analysis · *Working (upload and results); export in development*

Compares sentiment labels the researcher has already assigned. **The tool does not classify text itself.**

- **Upload** a CSV with the texts and a label column. Labels can be words (positive, negative, neutral in Arabic or English) or numbers from −1 to 1.
- **Checks:** detects the file encoding (so Arabic from Excel displays correctly) and the separator. Damaged rows are reported, not silently dropped.
- **Unrecognised labels** are listed for the researcher to map or leave out.
- **Anonymise accounts** by replacing names with codes such as A001. The key file is downloaded to the researcher's device.
- **Results:** the distribution of labels and the average sentiment, from −1 to +1. Groups (for example by category, language or dialect) are compared with a chi-square test and Cramér's V, with a warning when groups are too small or the test is unreliable. Change over time is shown when dates are present.
- **Method note:** the results explain how each figure was calculated.
- **In development:** coder agreement (Krippendorff's alpha), the list of disagreements to resolve, and the export step.

## Tool 5: Social network analysis · *In development*

Planned features, not yet built:

- Upload an edge list, or a table of posts from which the network is built.
- Centrality measures for each account, network measures, and communities found by the Louvain method.
- An interactive network graph, with export to PNG, SVG, CSV, GEXF and GraphML.
- A plain-language report with the method and the usual cautions.

## Accounts · *Working locally*

- Researchers sign in with email and password. Passwords are stored only as secure hashes.
- The analysis tools' upload, results and export steps require sign-in. The homepage, the "about" pages and the studio remain open.
- Password reset by email is not yet available.

## Privacy

- Uploaded files are analysed on the researcher's device. They are not sent to a server.
- Files are not kept after the page is closed, unless the researcher chooses to save them.
- Guidance on anonymising accounts is shown before every upload.
- The platform does not collect data from social media platforms. Researchers are responsible for how they obtained their data and for following the platform's terms and their institution's ethics rules.

## Not yet available

- Automatic sentiment classification (planned for a later version, with stated accuracy for English and Gulf Arabic).
- Saving studies and responses to a shared database (the database is being connected).
- Walkable 3D interiors for shops (planned as an option beside the product screen).
