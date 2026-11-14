# How researchers do network and sentiment analysis today

Desk research, 14 November 2026, to guide the two analysis tools. Based on eight web searches; sources are listed at the end. Where the evidence is thin or comes from vendors, that is said.

## Social network analysis

**The usual workflow:** collect data, clean it into an edge list, compute measures, draw the network, write up.

**Tools in use**

| Tool | What it is | Limits reported |
|---|---|---|
| Gephi | Free desktop program with a visual interface; often recommended for larger networks | Needs a capable computer for large networks; weaker on networks that change over time |
| NodeXL | Works inside Excel | Needs a compatible Microsoft Office; suited to smaller networks |
| UCINET with NetDraw | Analytic engine (degree, betweenness, closeness, eigenvector) paired with a separate drawing program | Aimed at advanced academic users |
| R (igraph) and Python (networkx) | Scripted analysis, reproducible | Requires programming |
| Communalytic (successor to Netlytic) | Web-based, no code, free educational tier; network, sentiment, topic and civility analysis | Tied to its own collectors and tiers |
| 4CAT | Open source, collects and analyses, includes network analysis | Must be installed on a server |

A common pattern is to compute measures in R and export a file to Gephi for the picture.

**Data access is the main obstacle**

- X closed its free academic API in 2023 and now sells access.
- Meta shut down the CrowdTangle API on 14 August 2024. Its replacement, the Meta Content Library, is free for academics and non-profits, applied for through ICPSR, but runs in a "clean room": data cannot be downloaded or merged with other data, and volumes are restricted.
- Researchers have moved to scraping (fragile and variable), browser plugins, manual downloads, data donation by participants, and shared archives such as SOMAR.
- In a 2024 survey by the Coalition for Independent Technology Research, 88% of researchers feared these closures would significantly hinder their work.

## Sentiment analysis

**Methods in use**

- **Dictionary tools (VADER, LIWC).** Chosen because they are widely published, transparent and need no programming. Weak on negation, sarcasm and text outside the domain they were built for.
- **Commercial social listening tools** (for example Brandwatch).
- **Supervised classifiers.** More accurate within a domain, but need labelled training data and careful validation.
- **Large language models.** Results vary by prompt and model version, so they need validation for each task.

**How well they agree with human coders**

- A 2025 study of YouTube comments found only fair agreement between the tools and manual coding; ChatGPT 4.0 agreed poorly.
- A COVID-19 Twitter study: Brandwatch about 75.5%, VADER about 66.9%, LIWC about 63.3% agreement with human coding.
- The accepted check is comparison against a human-coded sample, reported with Krippendorff's alpha. A threshold of 0.667 is commonly cited but contested. Different agreement coefficients should not be compared directly.
- Guidance for language models: validate for each task on held-out human-labelled samples; one study found performance "highly contingent" on dataset and task.

**Arabic and Gulf dialects**

- Models used: MARBERT, CAMeLBERT, AraBERT, often fine-tuned on a specific dialect or dataset.
- Reported problems: people rarely write Modern Standard Arabic on social media; posts mix dialects; Arabic and English are switched mid-sentence; sarcasm; and "Gulf Arabic" is not one dialect (Saudi, Emirati, Kuwaiti and Qatari usage differ).
- A model fine-tuned on Saudi data notes that performance on other dialects is untested.
- Evidence here is weak: mostly vendor pages and scattered papers. No head-to-head benchmark for Gulf sentiment was found, and nothing on how Gulf media researchers validate tool output.

## What this means for the two tools

1. **Upload-your-own-file fits how researchers now work.** Since official access shrank, they arrive with files from many routes. Add import presets for the formats they already have (4CAT and Communalytic exports, Gephi's GEXF and GraphML).
2. **Export to Gephi matters.** Researchers pair tools, so GEXF/GraphML export keeps ours in their workflow.
3. **No install, no code, results on the device.** Existing options need a desktop install, Excel, a server, or programming.
4. **Sentiment phase 1 matches the accepted standard.** Human coding is the benchmark, so a tool that aggregates the researcher's own labels is defensible. Make inter-coder agreement (Krippendorff's alpha) a core feature, not an extra.
5. **Phase 2's test unit is the right design.** The literature says to validate automatic labels per task against a human sample before use.
6. **Do not treat Gulf Arabic as one dialect.** Allow a dialect or country column for comparisons, and state accuracy per dialect in phase 2.
7. **Plain-language report must carry the standard cautions**, for example that high betweenness does not mean the most connections.

## Limits of this research

- No data was found on how many communication researchers use each tool.
- Nothing was found on graduate students' specific difficulties.
- Several sources are vendor or aggregator pages; the studies cited are few and some are preprints.
- Current X pricing and Content Library eligibility were not checked on the platforms' own sites.

## Sources

- https://pure.kfupm.edu.sa/en/publications/social-network-analysis-visualization-tools-a-comparative-review/
- https://visiblenetworklabs.com/2024/02/14/social-network-analysis-tools-for-mapping-relationships/
- https://ichromatiq.blogspot.com/2010/09/analyzing-email-communications-ego.html
- https://dl.acm.org/doi/10.1145/3816985
- https://journals.sagepub.com/doi/full/10.1177/00027162251372557
- https://arxiv.org/pdf/2506.10942
- https://www.nature.com/articles/s44482-025-00002-6
- https://faq.library.princeton.edu/econ/faq/44212
- https://www.thelabs.sp.unipi.it/wp-content/uploads/2025/10/TLQ-2025.03.03-Acampa-A-new-wave-of-social-media-APIs-restrictions.pdf
- https://formative.jmir.org/2025/1/e57395
- https://arxiv.org/pdf/2108.04816
- https://scdenney.github.io/thesis-supervision/methods/quantitative/sentiment-analysis
- https://ar5iv.labs.arxiv.org/html/2306.00176
- https://arxiv.org/pdf/2411.19638
- https://arxiv.org/html/2401.15170v2
- https://socialmedialab.ca/web/?p=24232
- https://ranke2.uni.lu/u/guide-collecting-posts-communalytic/
- https://github.com/digitalmethodsinitiative/4cat
- https://library.sfc.edu/digitalresources/scraping
- https://www.toptal.com/r/social-network-analysis-in-r-gephi-tutorial
- https://peerj.com/articles/cs-2644
- https://huggingface.co/whrivt/camelbert-saudi-gmaps-sentiment
- https://aimtechnologies.co/arabic-sentiment/
- https://sproutsocial.com/es/glossary/arabic-sentiment-analysis/
