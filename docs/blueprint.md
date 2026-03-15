# **App Name**: ECH Probe

## Core Features:

- Domain Input & Resolver Selection: Allow users to input a domain name for ECHConfig analysis and select multiple preset public DoH resolvers (e.g., Cloudflare, Google, Alibaba, Tencent), custom DoH resolvers, or local DNS resolvers to query.
- Backend DoH Query Executor: Send DNS over HTTPS (DoH) queries from a backend service (e.g., deployed on Vercel) to retrieve HTTPS records for the specified domain from all selected DoH resolvers.
- Local DNS Query Executor: Execute standard DNS queries against local system resolvers to retrieve HTTPS records for the specified domain, allowing comparison with DoH results.
- Robust ECHConfig Detector: Parse the retrieved HTTPS records with detailed logic to accurately identify the presence, content, and validity of ECHConfig, handling various formats, edge cases, and graceful absence detection.
- Multi-Source Response Comparison: Compare and display the ECHConfig detection results and other HTTPS record data obtained from all queried DoH and local DNS resolvers, highlighting any discrepancies or consistencies.
- Results Display: Display whether ECHConfig was found for each resolver, and if so, present key parameters in a user-friendly format, including comparison data from multiple sources.
- ECH Insight Generator: Utilize a generative AI tool to provide explanations and insights into the detected ECHConfig or its absence, offering guidance on privacy and security implications based on the analysis.

## Style Guidelines:

- The application will utilize a sophisticated dark mode. The primary color is a deep blue-violet (#4D4DB3), chosen for its association with technology and security, offering a professional yet engaging feel. The background is an ultra-dark blue-gray (#15151A), providing high contrast for text and interface elements, reducing eye strain. The accent color is a bright cyan (#75E1FF), used sparingly for interactive elements and highlights to draw attention and indicate action.
- Headlines and prominent text will use 'Space Grotesk' (sans-serif) for its modern, technical aesthetic. Body text and longer descriptions will use 'Inter' (sans-serif) to ensure readability and maintain a consistent, contemporary look.
- Geometric and minimalist icons will be used throughout, consistent with the tech-oriented nature of the app. Icons will be monochromatic, using the accent color for active states or important indicators.
- A clean, structured layout with a focus on clear input fields and dedicated results sections. Content will be well-spaced to avoid clutter, with an emphasis on scannable information display.
- Subtle, fluid transitions and micro-interactions will provide visual feedback, especially during query execution and when new results are presented, ensuring a smooth and responsive user experience without distraction.