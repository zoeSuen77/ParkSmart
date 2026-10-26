# ParkSmart

**Campus Parking Availability and Management System**  
ICSI 418 Software Engineering · Team 5 · University at Albany  
Instructor: Dr. Shashank Arora

ParkSmart is a planned web application for UAlbany commuter students. It will help students compare parking lot availability, view individual parking spaces, reserve a space after arriving at a lot, and release it when they leave.

**Status: Planning and design.** This repository currently contains the project proposal and initial UI sketches. The features below are planned, not implemented. Application code and a deployed demo will be added as development progresses.

## The problem

Finding campus parking takes extra time when drivers do not know which lots have available spaces. ParkSmart aims to make parking information easier to access and update application records as students reserve and release spaces.

The initial audience is commuter students with commuter parking permits. University Parking Services is a potential stakeholder; access to university systems or live parking data has not been established.

## Planned MVP

| Feature | Planned behavior |
| --- | --- |
| License plate entry | Associate a vehicle with a parking session or reservation. |
| Commuter parking lot directory | Browse the commuter lots represented in the system. |
| Capacity and availability | Display available-space counts and high, medium, or low availability indicators. |
| Individual parking spaces | Show spaces marked available or reserved in a selected lot. |
| Reserve a space | Record a reservation and prevent two students from reserving the same space simultaneously. |
| Release a space | Release a reservation when leaving and update availability. |

## Intended user flow

1. Enter a license plate number.
2. Browse commuter parking lots and compare availability.
3. Select a lot and view its available spaces.
4. After arriving at the lot, select a space and confirm the reservation.
5. View a confirmation with the lot, space number, and vehicle information.
6. Select **Leave Spot** and confirm to release the reservation.

The UI sketches illustrate plate entry, lot selection with availability indicators, space selection, reservation confirmation, and a release confirmation dialog. They are design ideas rather than a finalized interface.

## Optional stretch goals

- **Location checks:** Check whether a user is near a selected lot before allowing a reservation.
- **Automatic release:** Explore releasing a reservation when the user leaves the parking area.
- **Notifications:** Provide reservation updates or reminders to release a space.

These features will be considered after the core workflow is implemented and tested.

## Proposed technology stack

| Area | Technologies |
| --- | --- |
| Frontend | React, HTML, CSS, JavaScript |
| Backend | Node.js, Express |
| Database | MongoDB |
| Collaboration | Git, GitHub |

These choices may be refined as requirements and design decisions are finalized.

## Project documents

- [Project proposal](docs/project-proposal.md) — a Markdown rendering of the supplied proposal.
- [Original proposal text](docs/project-proposal-original.txt) — the supplied text preserved unchanged.
- [Project UI Ideas (PDF)](docs/Project%20UI%20Ideas.pdf) — the original interface sketches and design notes.

Source documents are retained as supplied and may include earlier names or exploratory features. This README uses **ParkSmart** as the working name and follows the proposal's separation between essential and optional features.

## Design questions to resolve

- **Availability data:** Decide how initial lot and space records will be populated and updated. Application records alone cannot confirm that a physical space is empty. Any simulated demo data should be clearly labeled.
- **Reservation ownership:** A license plate identifies a vehicle but is not proof of user identity. Define how users may access and release only their own reservations.
- **Consistency:** Specify duplicate-request handling, simultaneous reservations, and how space status and lot counts stay in sync.
- **Missed releases:** Define how to handle forgotten releases and reservations that are not used.
- **Permit lookup and availability indicators:** The sketches explore permit lookup and color-coded availability. Confirm the data source and consistent thresholds before implementation; live university integration is not assumed.

## Development outline

1. Finalize requirements, user stories, and acceptance criteria.
2. Define the data model, architecture, UI mockups, and API contracts.
3. Build lot and space-availability views.
4. Implement reservation and release operations with persistent data.
5. Test complete workflows, conflicting requests, and failure cases.
6. Deploy a prototype, collect feedback, and prepare the final demonstration.

Milestone deliverables and deadlines follow the instructor's assignment instructions.

## Team members

- Leigha Schilling
- Kanza Fatima
- Denise Ortiz
- Nelson Hudgins
- Yuhan Sun

## Working with this repository

Track tasks and decisions in GitHub issues. Submit changes through branches and pull requests for team review, and keep documents synchronized with the agreed MVP. Do not commit credentials, environment files, or real vehicle data used during testing.

There is no runnable application yet. Installation, configuration, testing, and deployment instructions will be added with the implementation.
