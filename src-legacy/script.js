// Modal functionality
document.addEventListener('DOMContentLoaded', () => {
  // Get all program cards
  const programCards = document.querySelectorAll('.program-card');
  
  // Get modal elements
  const modal = document.querySelector('.modal');
  const modalClose = document.querySelector('.modal-close');
  
  // Function to open modal
  function openModal() {
    modal.classList.add('show');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  }
  
  // Function to close modal
  function closeModal() {
    modal.classList.remove('show');
    document.body.style.overflow = ''; // Restore background scrolling
  }
  
  // Add click event to each program card
  programCards.forEach(card => {
    card.addEventListener('click', openModal);
  });
  
  // Add click event to close button
  if (modalClose) {
    modalClose.addEventListener('click', closeModal);
  }
  
  // Close modal when clicking outside
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
  
  // Close modal with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('show')) {
      closeModal();
    }
  });
}); 