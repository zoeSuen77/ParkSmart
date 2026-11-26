ICSI 418

Dr. Shashank Arora

# Team 5 Project Proposal

## Team Members:

- Leigha Schilling

- Kanza Fatima

- Denise Ortiz

- Nelson Hudgin

- Yuhan Sun

## Project Title:

LotSpot: Campus Parking Availability and Management System

ParkSmart: Campus Parking Availability and Management System

## Project Description:

Trying to find an available parking spot on campus can be frustrating, especially during busy hours when students and school staff are trying to get to their class or to work on time. Drivers looking for parking might spend extra time looking for different parking lots without knowing which ones have open spots.

ParkSmart is a web-based application designed to help commuter students at UAlbany find available parking spots more easily. The app will allow users to view campus parking lots, check reported parking availability, search for suitable parking areas, and receive useful information such as permit requirements, accessibility, and operating restrictions.

Once a spot is reserved, the application will display a confirmation with the parking lot, spot number, and license plate. Users can release their reserved spot when they leave, allowing it to become available for someone else. The application will also include notifications

## Project Requirements:

### Main functionality:

The main purpose of our application is to help commuter students find available parking spots on campus. Students will be able to enter their license plate number, view commuter parking lots and their current availability, select a lot, and see which parking spots are open. Once they arrive at the lot, they can reserve an available spot. When they leave, they can unreserve the spot so it becomes available for another student.

### Essential Features (Minimum Viable Product):

#### License Plate Entry

The user will enter their license plate number to access the parking system. Since our current project is focused on commuter parking, the system will be designed for commuter students.

#### View Commuter Parking Lots

The application will display the commuter parking lots available on campus. Each lot will show its current parking availability so students can see which lots have more open spots.

#### View Parking Lot Capacity

Students will be able to see how full each parking lot is. The system can show the number of available spots and indicate whether the lot has high, medium, or low availability.

#### View Available Parking Spots

After selecting a parking lot, the student will be able to view the individual parking spots in that lot. The system will clearly show which spots are available and which spots are already reserved.

#### Reserve a Parking Spot

When a student arrives at the parking lot, they can select an available spot and reserve it. Once the reservation is made, that spot will be marked as reserved so another student cannot reserve the same spot.

#### Unreserve a Parking Spot

When the student leaves the parking spot, they can unreserve it. The system will update the spot back to available so another commuter student can reserve it.

### Optional Stretch Goals:

#### Location Tracking

If we have enough time, we could use the student's location to check if they are actually near the selected parking lot before allowing them to reserve a spot.

#### Automatic Unreserving

The system could automatically unreserve a student's parking spot when it detects that the student has left the parking lot area.

#### Notifications

The application could send notifications or reminders about a student's reserved parking spot, such as reminding them to unreserve the spot when they leave.

## Technology Stack:

### Frontend: React, HTML, CSS, and JavaScript

We plan to use React to build the frontend of the application. React will be used to create the different pages and components, such as the parking lot list, parking availability, individual parking spots, and the reserve and unreserve buttons. HTML and CSS will be used to organize and style the pages, while JavaScript will handle the interactions in the application.

### Backend: Node.js and Express

We plan to use Node.js with Express for the backend. The backend will handle requests from the frontend and communicate with the database. For example, when a student reserves or unreserves a parking spot, the frontend will send a request to the backend. The backend will then update the parking spot information and send the updated information back to the frontend.

### Database: MongoDB

We plan to use MongoDB to store the information needed for the application. This could include commuter users, license plate information, parking lots, parking spots, and reservations. MongoDB will allow the system to retrieve and update parking information when students reserve or unreserve spots.

### Version Control: Git and GitHub

We plan to use Git and GitHub to manage our project and keep track of changes to the code. GitHub will also allow our team members to work on the project together and keep the project files organized.

Overall, these technologies are a good fit for our project because we have already worked with them in our programming assignments. This will allow us to focus more on building and testing the parking system instead of learning a completely new technology stack.

## Feasibility Check:

### Who is the customer?

The customer would be the university’s Parking Services department. The main users would be commuter students who have a commuter parking permit. Parking Services would be responsible for the parking lot and spot information, while commuter students would use the system to help them find available parking.

### How would this realistically be used?

Commuter students would enter their license plate number to use the system. The system would show the commuter parking lots and how full each lot currently is. For example, the lots could show whether they have high, medium, or low availability based on the number of open spots. A student could select a parking lot, view its open stalls, and reserve an available spot when they get to the lot. Once the spot is reserved, it would no longer show as available to other students. When the student leaves, they can unreserve the spot so it becomes available again.

### What is the biggest technical risk?

The biggest technical risk is keeping the parking availability accurate and updated. When a student reserves a spot, the system needs to update that spot and the overall availability of the parking lot. It also needs to prevent two students from reserving the same spot at the same time. Location tracking and automatically detecting when a student leaves the parking area could also be more difficult to implement.

### What is the biggest scope risk?

The biggest scope risk is trying to add too many features at once. Our main goal is to create a working system for commuter parking where students can view parking availability, see open spots, reserve a spot, and unreserve it when they leave. Features such as location tracking, automatic unreserving, and notifications could make the project larger and take more time to complete. These features can be added later if we have enough time.

### What would make this project fail?

The project could fail if the parking availability is not updated correctly or if students reserve spots but do not actually use them. This could cause the system to show incorrect information to other students. The project could also fail if two students are able to reserve the same spot or if we try to include too many features and do not have enough time to finish and properly test the main features.
