  <button className='sign-in-button'>
    Sign In
    {isLoading && <Loader className='loader' />}
  </button>

  ...

  <button className='verify-button'>
    Verify
    {isLoading && <Loader className='loader' />}
  </button>